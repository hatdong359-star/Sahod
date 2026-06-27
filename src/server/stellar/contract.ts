import { createHash } from 'node:crypto';
import {
  Account,
  Address,
  Contract,
  nativeToScVal,
  rpc,
  scValToNative,
  type Transaction,
  TransactionBuilder,
  xdr,
} from '@stellar/stellar-sdk';
import { toStroops } from '@/server/lib/amount';
import { AppError } from '@/server/lib/http';
import { contractIds, getNetworkPassphrase, network } from './network';

/**
 * Sahod salary-split contract glue.
 *
 * The browser only ever *signs*. Every Soroban RPC round-trip (simulate / submit
 * / poll) runs here on the server so the client never talks to RPC directly:
 *
 *   buildPaySplitXdr() -> payer signs in Freighter -> submitSorobanSigned()
 *
 * One `pay_split` invocation funds the contract with the whole paycheck and fans
 * it out to every recipient atomically — pay-in and every payout in one tx.
 */

// Inclusion-fee cap (stroops), well above BASE_FEE so a multi-recipient split is
// not dropped under testnet congestion. Soroban resource fees are added on top
// by assembleTransaction; this is only the max inclusion fee we will pay.
const INCLUSION_FEE = '2000000';

function server(): rpc.Server {
  const url = network.rpcUrl;
  return new rpc.Server(url, { allowHttp: url.startsWith('http://') });
}

function splitContract(): Contract {
  if (!contractIds.salarySplit) {
    throw new AppError('INTERNAL', 'Salary-split contract id is not configured.', 500);
  }
  return new Contract(contractIds.salarySplit);
}

/** Deterministic 32-byte receipt key = sha256(run ref). Matches the contract. */
export function splitRef(runRef: string): Buffer {
  return createHash('sha256').update(runRef, 'utf8').digest();
}

export const SALARY_SPLIT_CONTRACT_ID = contractIds.salarySplit;

// --- Per-account sequence serialization -----------------------------------
// Two invocations from the SAME source must not interleave: each one reads the
// account sequence to build/sign, so overlapping them yields a stale seq and a
// txBadSeq rejection. We chain all work for a given account through one promise.
const accountLocks = new Map<string, Promise<unknown>>();

function withAccountLock<T>(account: string, fn: () => Promise<T>): Promise<T> {
  const prev = accountLocks.get(account) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  accountLocks.set(
    account,
    next.then(
      () => undefined,
      () => undefined,
    ),
  );
  return next;
}

export type SplitLine = { address: string; amount: string };

/**
 * Build an UNSIGNED, simulation-assembled `pay_split` tx for the payer to sign.
 * `runRef` is hashed to the 32-byte receipt key, so each run settles once.
 */
export async function buildPaySplitXdr(params: {
  payer: string;
  runRef: string;
  lines: SplitLine[];
}): Promise<string> {
  if (!Address.fromString(params.payer)) {
    throw new AppError('INVALID_INPUT', 'Invalid payer address.', 400);
  }
  if (params.lines.length === 0 || params.lines.length > 20) {
    throw new AppError('INVALID_INPUT', 'A split needs between 1 and 20 recipients.', 400);
  }

  const refScv = nativeToScVal(splitRef(params.runRef), { type: 'bytes' });
  const payerScv = new Address(params.payer).toScVal();
  const recipientsScv = xdr.ScVal.scvVec(params.lines.map((l) => new Address(l.address).toScVal()));
  const amountsScv = xdr.ScVal.scvVec(
    params.lines.map((l) => nativeToScVal(toStroops(l.amount), { type: 'i128' })),
  );

  const op = splitContract().call('pay_split', refScv, payerScv, recipientsScv, amountsScv);

  return withAccountLock(params.payer, async () => {
    const srv = server();
    const account = await srv.getAccount(params.payer);
    const tx = new TransactionBuilder(account, {
      fee: INCLUSION_FEE,
      networkPassphrase: getNetworkPassphrase(),
    })
      .addOperation(op)
      .setTimeout(180)
      .build();

    // Retry simulation a few times — testnet RPC occasionally lags on a freshly
    // funded recipient account or under load.
    let sim = await srv.simulateTransaction(tx);
    for (let i = 0; i < 4 && rpc.Api.isSimulationError(sim); i++) {
      await sleep(1500);
      sim = await srv.simulateTransaction(tx);
    }
    if (rpc.Api.isSimulationError(sim)) {
      throw new AppError('INVALID_INPUT', `Simulation failed: ${sim.error}`, 400);
    }
    return rpc.assembleTransaction(tx, sim).build().toXDR();
  });
}

/** Submit a signed Soroban tx and poll until it lands. Re-injects on drops. */
export async function submitSorobanSigned(signedXdr: string): Promise<string> {
  let tx: Transaction;
  try {
    tx = TransactionBuilder.fromXDR(signedXdr, getNetworkPassphrase()) as Transaction;
  } catch {
    throw new AppError('INVALID_INPUT', 'Signed transaction could not be decoded.', 400);
  }
  const source = tx.source;
  return withAccountLock(source, async () => {
    const srv = server();
    let sent = await srv.sendTransaction(tx);
    if (sent.status === 'TRY_AGAIN_LATER') {
      throw new AppError('TX_RETRY', 'Network busy — please retry the split.', 409);
    }
    if (sent.status === 'ERROR') {
      const code = errorResultCode(sent.errorResult);
      if (code === 'txBadSeq' || code === 'txTooLate') {
        throw new AppError('TX_RETRY', 'Sequence moved — rebuilding the split.', 409);
      }
      throw new AppError('CONFLICT', `Transaction rejected${code ? `: ${code}` : ''}.`, 409);
    }
    const hash = sent.hash;
    for (let i = 0; i < 28; i++) {
      const got = await srv.getTransaction(hash);
      if (got.status === 'SUCCESS') return hash;
      if (got.status === 'FAILED') {
        throw new AppError('CONFLICT', `Split ${hash} failed on-chain.`, 409);
      }
      // Still NOT_FOUND — testnet drops Soroban txs under load. Re-inject the
      // same (idempotent) envelope every ~4.5s so a dropped tx still lands.
      if (i > 0 && i % 3 === 0) {
        sent = await srv.sendTransaction(tx).catch(() => sent);
      }
      await sleep(1500);
    }
    throw new AppError('INTERNAL', `Timed out waiting for ${hash}.`, 504);
  });
}

/** Best-effort transaction result code from a sendTransaction ERROR envelope. */
function errorResultCode(errorResult: unknown): string {
  try {
    const r = errorResult as { result?: () => { switch: () => { name: string } } };
    return r?.result?.().switch().name ?? '';
  } catch {
    return '';
  }
}

function readSource(): Account {
  // Read-only simulations need a valid source account; the admin always exists.
  return new Account(contractIds.admin, '0');
}

async function simulateNative<T>(method: string, ...args: xdr.ScVal[]): Promise<T> {
  const op = splitContract().call(method, ...args);
  const tx = new TransactionBuilder(readSource(), {
    fee: INCLUSION_FEE,
    networkPassphrase: getNetworkPassphrase(),
  })
    .addOperation(op)
    .setTimeout(60)
    .build();
  const sim = await server().simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new AppError('INTERNAL', `Read ${method} failed: ${sim.error}`, 502);
  }
  const retval = sim.result?.retval;
  if (!retval) throw new AppError('INTERNAL', `Read ${method} returned nothing.`, 502);
  return scValToNative(retval) as T;
}

export type ContractState = {
  contractId: string;
  admin: string;
  totalPaidStroops: string;
  totalSplits: number;
};

/** Read lifetime totals from the contract (no signature). */
export async function getContractState(): Promise<ContractState> {
  const [totalPaid, totalSplits] = await Promise.all([
    simulateNative<bigint>('total_paid'),
    simulateNative<bigint>('total_splits'),
  ]);
  return {
    contractId: contractIds.salarySplit,
    admin: contractIds.admin,
    totalPaidStroops: BigInt(totalPaid).toString(),
    totalSplits: Number(totalSplits),
  };
}

export type SplitReceipt = {
  payer: string;
  totalStroops: string;
  recipients: number;
  ledger: number;
};

/** Read a single on-chain receipt. Null if the run has not been settled. */
export async function getReceipt(runRef: string): Promise<SplitReceipt | null> {
  const refScv = nativeToScVal(splitRef(runRef), { type: 'bytes' });
  try {
    const native = await simulateNative<{
      payer: string;
      total: bigint;
      recipients: number;
      ledger: number;
    }>('get_receipt', refScv);
    return {
      payer: native.payer,
      totalStroops: BigInt(native.total).toString(),
      recipients: Number(native.recipients),
      ledger: Number(native.ledger),
    };
  } catch {
    return null; // ReceiptNotFound traps -> absent
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
