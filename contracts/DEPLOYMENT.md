# Sahod Salary Split — Deployment Record

## Testnet (LIVE)

- Contract ID: `CDZW27BK653JQ7JIC5RHQBGWYXW5PRZU2BBL7GHKVPBTDR4AUKMFBZ24`
- Admin: `GBL5RJKF4QNJ4ZPLJZ7PS7K5A4J44VEZJRV2CRTFFDRVSY2N76AIIE47` (deployer)
- Pool token (SAC): native XLM `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`
- Network passphrase: `Test SDF Network ; September 2015`
- Soroban RPC: `https://soroban-testnet.stellar.org`
- WASM hash: `d748cce25f1f60cc0837d1a31a7a8b0033211b9c97739a28ae99e76ee6b28250`
- Optimized wasm: 16,909 bytes

Explorer: https://stellar.expert/explorer/testnet/contract/CDZW27BK653JQ7JIC5RHQBGWYXW5PRZU2BBL7GHKVPBTDR4AUKMFBZ24

### Deploy transactions
- upload + deploy: `ae4cdd0a6984c7790d63ed6bd892c8af2c922e0e45b3a49b36a876c61acc43df`
- create contract: `7c52a134c33be270274d4a5cf4124183947e704969720729ffbc9fc6295083d7`
- initialize: confirmed on-chain (`get_admin` / `get_token` read back the admin + XLM SAC)

## Entrypoints

| Method | Auth | Effect |
|---|---|---|
| `initialize(admin, token)` | admin | one-time; records admin + pool SAC token |
| `pay_split(split_ref, payer, recipients, amounts)` | payer | ATOMIC: SAC transfer payer -> contract (total), then contract -> each recipient (share); writes a permanent receipt; returns total |
| `get_receipt(split_ref)` | — (view) | read a receipt (payer, total, recipients, ledger) |
| `is_paid(split_ref)` | — (view) | true once a run is settled |
| `total_paid() / total_splits()` | — (view) | lifetime total + run count |
| `get_admin() / get_token() / is_paused()` | — (view) | config |
| `pause() / unpause() / set_admin(a) / upgrade(hash)` | admin | operational controls |

`split_ref` = sha256(Sahod run id), 32 bytes — the double-pay-proof receipt key.

The pay-in and every payout execute inside the SAME `pay_split` invocation, so a
run either clears completely or reverts completely. The contract never holds a
float: whatever is pulled in is fanned straight back out in the same call.

## Reproduce

```bash
cd source-code/contracts
cargo +1.89.0 test                                    # 10 passed; 0 failed
cargo +1.89.0 build --release --target wasm32-unknown-unknown
stellar contract optimize --wasm target/wasm32-unknown-unknown/release/salary_split.wasm
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/salary_split.optimized.wasm \
  --source deployer --network testnet
stellar contract invoke --id <ID> --source deployer --network testnet -- \
  initialize --admin GBL5RJKF4QNJ4ZPLJZ7PS7K5A4J44VEZJRV2CRTFFDRVSY2N76AIIE47 \
  --token CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC
```

## Mainnet

- Contract ID: (not deployed) — switch via `./scripts/deploy.sh public`, set
  `STELLAR_NETWORK=public` and `SOROBAN_RPC_URL=https://soroban.stellar.org`
  in `.env.local`, and re-`initialize` with the mainnet native XLM SAC.
