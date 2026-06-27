'use client';

import { ArrowLeft, CheckCircle2, ExternalLink, Loader2, Send, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { publicEnv } from '@/server/config/env.public';
import { Header } from '@/ui/components/Header';
import { AssetBadge, Footer } from '@/ui/components/ui';
import type { AssetCode } from '@/ui/lib/format';
import {
  allocateShares,
  explorerAccount,
  explorerContract,
  explorerTx,
  fmtAmount,
  shortKey,
} from '@/ui/lib/format';
import { enableUsdc, paySplit, sign, WalletError } from '@/ui/wallet/stellarClient';
import { useWallet } from '@/ui/wallet/WalletProvider';

type Recipient = { id: string; label: string; address: string; sharePct: number };
type Line = { id: string; label: string; address: string; sharePct: number; amount: string };
type Run = {
  id: string;
  asset: string;
  totalAmount: string;
  txHash: string;
  network: string;
  mode?: string;
  createdAt: string;
  lines: Line[];
};
type Split = {
  id: string;
  name: string;
  asset: AssetCode;
  network: string;
  recipients: Recipient[];
  runs: Run[];
};

async function api(path: string, body?: unknown) {
  const res = await fetch(path, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({ ok: false }));
  if (!json.ok) throw new Error(json.error?.message ?? `Request failed (${res.status})`);
  return json.data;
}

export default function SplitDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { status, publicKey, connect } = useWallet();
  const [split, setSplit] = useState<Split | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [paying, setPaying] = useState(false);
  const [enabling, setEnabling] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api(`/api/splits/${id}`);
      setSplit(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load split');
    }
  }, [id]);

  useEffect(() => {
    if (status === 'connected') void load();
  }, [status, load]);

  const preview = useMemo(() => {
    if (!split || !amount || Number(amount) <= 0) return null;
    const amounts = allocateShares(
      amount,
      split.recipients.map((r) => r.sharePct),
    );
    return split.recipients.map((r, i) => ({ ...r, amount: amounts[i] }));
  }, [split, amount]);

  async function handlePay() {
    if (!split || !publicKey) return;
    if (!amount || Number(amount) <= 0) return toast.error('Enter the paycheck amount');
    const lines = allocateShares(
      amount,
      split.recipients.map((r) => r.sharePct),
    );
    const payLines = split.recipients.map((r, i) => ({ address: r.address, amount: lines[i] }));
    if (payLines.some((l) => Number(l.amount) <= 0)) {
      return toast.error('That amount is too small to give every recipient a share');
    }
    setPaying(true);
    try {
      if (split.asset === 'XLM') {
        await payViaContract();
      } else {
        // Opt-in USDC path: classic multi-payment built and signed client-side.
        const txHash = await paySplit({
          from: publicKey,
          asset: split.asset,
          memo: `Sahod ${split.name}`,
          lines: payLines,
        });
        await api(`/api/splits/${id}/runs`, { txHash, totalAmount: amount });
      }
      toast.success('Everyone paid', {
        description:
          split.asset === 'XLM'
            ? 'Funded and split through the Soroban contract in one transaction.'
            : 'Recorded and verified on-chain.',
      });
      setAmount('');
      await load();
    } catch (e) {
      const msg = e instanceof WalletError || e instanceof Error ? e.message : 'Payment failed';
      toast.error('Split failed', { description: msg });
    } finally {
      setPaying(false);
    }
  }

  /**
   * Atomic XLM path. The server builds the `pay_split` invoke (one tx that funds
   * the contract AND fans the paycheck out to every recipient), the wallet signs
   * it, and the server submits + polls Soroban RPC. If the account sequence moved
   * between build and submit the server replies TX_RETRY — we rebuild once.
   */
  async function payViaContract() {
    if (!split || !publicKey) return;
    for (let attempt = 0; attempt < 2; attempt++) {
      const built = await api(`/api/splits/${id}/runs/build`, { totalAmount: amount });
      const signedXdr = await sign(built.xdr, publicKey);
      try {
        await api(`/api/splits/${id}/runs`, { signedXdr, totalAmount: amount });
        return;
      } catch (e) {
        const retry = e instanceof Error && /retry|sequence|busy/i.test(e.message);
        if (retry && attempt === 0) continue;
        throw e;
      }
    }
  }

  async function handleEnableUsdc() {
    if (!publicKey) return;
    setEnabling(true);
    try {
      await enableUsdc(publicKey);
      toast.success('USDC enabled on your wallet');
    } catch (e) {
      const msg =
        e instanceof WalletError || e instanceof Error ? e.message : 'Could not enable USDC';
      toast.error('Enable USDC failed', { description: msg });
    } finally {
      setEnabling(false);
    }
  }

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-4xl px-5 py-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft transition hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          My splits
        </Link>

        {status !== 'connected' ? (
          <div className="card mt-6 mx-auto max-w-lg p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
              <Wallet className="h-6 w-6" />
            </div>
            <h1 className="font-display mt-4 text-2xl font-bold text-ink">
              Connect to view this split
            </h1>
            <p className="mt-2 text-ink-soft">Splits are scoped to the wallet that created them.</p>
            <button
              type="button"
              data-testid="connect-cta"
              onClick={() => void connect()}
              className="btn-primary mx-auto mt-6 inline-flex h-12 items-center gap-2 rounded-full px-6 font-semibold"
            >
              <Wallet className="h-4 w-4" />
              Connect wallet
            </button>
          </div>
        ) : error ? (
          <div className="card mt-6 p-8 text-center">
            <p className="font-semibold text-ink">{error}</p>
            <Link
              href="/dashboard"
              className="btn-ghost mt-5 inline-flex h-11 items-center rounded-full px-5 text-sm font-medium"
            >
              Back to my splits
            </Link>
          </div>
        ) : !split ? (
          <div className="card mt-6 flex items-center gap-3 p-8 text-ink-soft">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading split…
          </div>
        ) : (
          <>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="font-display text-3xl font-bold text-ink">{split.name}</h1>
                  <AssetBadge asset={split.asset} />
                </div>
                <p className="mt-1 text-ink-soft">
                  {split.recipients.length} recipients · {split.runs.length} payout
                  {split.runs.length === 1 ? '' : 's'}
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_0.9fr]">
              {/* Pay panel */}
              <section className="card p-6">
                <h2 className="font-display text-lg font-bold text-ink">Run this split</h2>
                <p className="mt-1 text-sm text-ink-soft">
                  {split.asset === 'XLM'
                    ? 'Enter the paycheck that just arrived. One signature funds the Soroban contract and fans it out to everyone — atomically, in a single transaction.'
                    : 'Enter the paycheck that just arrived. We split it by each share and pay everyone in one transaction.'}
                </p>

                <label className="mt-5 block">
                  <span className="text-sm font-medium text-ink">
                    Paycheck amount ({split.asset})
                  </span>
                  <input
                    data-testid="paycheck-amount"
                    value={amount}
                    inputMode="decimal"
                    onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                    placeholder="0.00"
                    className="field mt-1.5 text-lg tnum"
                  />
                </label>

                {preview && (
                  <ul className="mt-4 space-y-2" data-testid="preview">
                    {preview.map((p) => (
                      <li key={p.id} className="flex items-center justify-between text-sm">
                        <span className="text-ink-soft">
                          {p.label} <span className="text-ink-soft/70">· {p.sharePct}%</span>
                        </span>
                        <span className="tnum font-semibold text-ink">
                          {fmtAmount(p.amount)} {split.asset}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                <button
                  type="button"
                  data-testid="pay-button"
                  onClick={() => void handlePay()}
                  disabled={paying}
                  className="btn-primary mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full font-semibold"
                >
                  {paying ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {paying ? 'Paying everyone…' : 'Pay everyone'}
                </button>

                {split.asset === 'XLM' && (
                  <p className="mt-3 text-center text-xs text-ink-soft">
                    Settled atomically through the{' '}
                    <a
                      href={explorerContract(publicEnv.salarySplitContractId, split.network)}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-brand-700 hover:underline"
                    >
                      salary-split contract
                    </a>
                  </p>
                )}

                {split.asset === 'USDC' && (
                  <button
                    type="button"
                    data-testid="enable-usdc"
                    onClick={() => void handleEnableUsdc()}
                    disabled={enabling}
                    className="btn-ghost mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-medium"
                  >
                    {enabling && <Loader2 className="h-4 w-4 animate-spin" />}
                    Enable USDC on my wallet
                  </button>
                )}
              </section>

              {/* Recipients */}
              <section className="card p-6">
                <h2 className="font-display text-lg font-bold text-ink">Recipients</h2>
                <ul className="mt-4 space-y-3">
                  {split.recipients.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium text-ink">{r.label}</div>
                        <a
                          href={explorerAccount(r.address, split.network)}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-xs text-ink-soft hover:text-brand-700"
                        >
                          {shortKey(r.address, 6, 6)}
                        </a>
                      </div>
                      <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-sm font-bold text-brand-800">
                        {r.sharePct}%
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            {/* History */}
            <section className="mt-6">
              <h2 className="font-display text-xl font-bold text-ink">Payout history</h2>
              {split.runs.length === 0 ? (
                <div className="card mt-3 p-8 text-center text-ink-soft">
                  No payouts yet. Run the split above to pay everyone at once.
                </div>
              ) : (
                <ul className="mt-3 space-y-3" data-testid="run-list">
                  {split.runs.map((run) => (
                    <li key={run.id} className="card p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-5 w-5 text-positive" />
                          <span className="font-display text-lg font-bold text-ink">
                            {fmtAmount(run.totalAmount)} {run.asset}
                          </span>
                          {run.mode === 'contract' && (
                            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-brand-800">
                              Contract
                            </span>
                          )}
                          <span className="text-sm text-ink-soft">
                            {new Date(run.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <a
                          href={explorerTx(run.txHash, run.network)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-full bg-mist px-3 py-1.5 text-sm font-semibold text-brand-800 hover:bg-brand-50"
                        >
                          View transaction
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        {run.lines.map((l) => (
                          <div
                            key={l.id}
                            className="flex items-center justify-between rounded-lg bg-paper px-3 py-2 text-sm"
                          >
                            <span className="text-ink-soft">
                              {l.label} <span className="text-ink-soft/70">· {l.sharePct}%</span>
                            </span>
                            <span className="tnum font-semibold text-ink">
                              {fmtAmount(l.amount)} {run.asset}
                            </span>
                          </div>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
