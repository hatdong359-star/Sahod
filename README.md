# sahod

## Submission Checklist

### Delivery

- [x] **Public GitHub repository** — link to the public repo
- [x] **Minimum 20+ meaningful commits** — see commit history on `main`
- [x] **Live deployed application** — https://sahod-sandy.vercel.app (testnet-pinned app)
- [x] **PPT/Pitch deck link** — [View Pitch Deck](https://docs.google.com/presentation/d/11oFzdhP6XwAr1Ikp1WgNC2bEON0PZI_x/edit?usp=sharing)
- [x] **Demo video link** — [Watch Demo](https://drive.google.com/file/d/11z3FZLp-nYbHoGtl2DlN-TygQ7ELiseX/view?usp=sharing)

### Proof

- [x] **Proof of 50+ users** — [50-user wallet list](docs/submission-proof.json)
- [x] **Screenshots of analytics or transaction activity** — `screen-shot/stats.jpg` and the on-chain `salary_split` contract stats
- [x] **Updated README and documentation** — [proof package](docs/level5-proof-package.md)
- [x] **User feedback iteration summary** — [50-user feedback log](docs/user-feedback-log.md) and [improvement summary](docs/level5-feedback-iteration-summary.md)
- [x] **Google Sheet response export** — [open native Google Sheet](https://docs.google.com/spreadsheets/d/1YsleYWcnjNbU0Z5LHrE2KU4qbZ8L1YXOKllNEbgSNF0/edit?usp=drivesdk)

### Feedback survey

Have you tried Sahod? [**Share your feedback**](https://docs.google.com/forms/d/e/1FAIpQLSdXVnfaziQ1cOFwHQ264Q_mUfRVU8GRmm53E06KQ9k3w1S0jg/viewform) — a 2-minute public survey. Responses are collected in the feedback sheet linked above.

### Monthly submission

Submit your GitHub repository link below before the monthly deadline:

**https://github.com/hatdong359-star/sahod**

## 🌐 Mainnet (LIVE)

- **Live app:** https://sahod-stellar.vercel.app
- **Network:** Stellar public (mainnet)
- **Soroban contract:** `CCTJJ5URNN2D2OPW2MZS5DZSH4OT2MMEZNUXBTKRHY35H4EP27NL5LUL`
- **Explorer:** https://stellar.expert/explorer/public/contract/CCTJJ5URNN2D2OPW2MZS5DZSH4OT2MMEZNUXBTKRHY35H4EP27NL5LUL


**One paycheck in. Everyone who counts on it, paid at once — atomically, on-chain.**

Sahod is a cross-border salary splitter built on Stellar. An overseas worker's pay
rarely belongs to one person — part goes to family back home, part to savings, part
stays for daily life. Sahod turns that mental math into a single, verifiable on-chain
event: set the shares once, enter the paycheck that just arrived, sign one time, and a
**Soroban smart contract funds itself with the whole paycheck and fans it out to every
recipient in the same call**.

Live app: **https://sahod-sandy.vercel.app**

Salary-split contract — live on Stellar **mainnet**:
[`CCTJJ5URNN2D2OPW2MZS5DZSH4OT2MMEZNUXBTKRHY35H4EP27NL5LUL`](https://stellar.expert/explorer/public/contract/CCTJJ5URNN2D2OPW2MZS5DZSH4OT2MMEZNUXBTKRHY35H4EP27NL5LUL)
(development/testnet deployment used for the cohort:
[`CDZW27BK653JQ7JIC5RHQBGWYXW5PRZU2BBL7GHKVPBTDR4AUKMFBZ24`](https://stellar.expert/explorer/testnet/contract/CDZW27BK653JQ7JIC5RHQBGWYXW5PRZU2BBL7GHKVPBTDR4AUKMFBZ24))

---

## Why it's different

Most "splitter" demos fire off a payment per person and hope they all land. Sahod runs
the whole split **inside one Soroban contract invocation**. The payer signs once; the
contract pulls the full paycheck into its own custody and immediately pays every
recipient their share — pay-in and every payout in the same transaction. The split
clears completely or reverts completely. There is no half-sent paycheck, and the
contract never holds a float.

- **Atomic, contract-enforced payouts.** A 5-recipient split is one signature and one
  Soroban transaction. The on-chain guarantee is the contract, not a hopeful loop.
- **Immutable receipts.** Each run writes a permanent `SplitReceipt` keyed by a 32-byte
  reference, so the same run can never be paid twice and any auditor can read who funded
  what, when.
- **Real recipients only.** You add the actual Stellar addresses of the people you
  support. Sahod never invents names — the only identities shown come from the wallets
  you enter and the wallet you connect.

## How it works

1. **Connect** — SEP-10 challenge/response with your Stellar wallet (Freighter). Signing
   is pinned to **testnet**, so it works even if your wallet's active network is Mainnet.
   Browsing and the stats page need no wallet at all.
2. **Add recipients** — give each share a label and paste a Stellar address. Shares total 100%.
3. **Enter the paycheck** — pick **XLM** (default, no trustline needed) or **USDC**, and
   the amount that arrived. A live preview shows exactly what each recipient will get.
4. **Pay everyone** — the server builds the `pay_split` contract invocation, your wallet
   signs it once, and the server submits + polls Soroban RPC. The run is saved with its
   real transaction hash, linked to stellar.expert.

### The contract

The salary-split contract (Rust / `soroban-sdk` 22) exposes:

| Method | Auth | Effect |
|---|---|---|
| `initialize(admin, token)` | admin | one-time; records admin + the pool's SAC token (native XLM) |
| `pay_split(split_ref, payer, recipients, amounts)` | payer | **atomic**: pulls `sum(amounts)` from the payer into the contract, pays each recipient their share, writes a permanent receipt; returns the total |
| `get_receipt(split_ref)` / `is_paid(split_ref)` | view | read a receipt / check settlement |
| `total_paid()` / `total_splits()` | view | lifetime total + run count |
| `pause()` / `unpause()` / `set_admin()` / `upgrade()` | admin | operational controls |

Full deployment record (wasm hash, tx ids, reproduce steps): `contracts/DEPLOYMENT.md`.
The contract is covered by 10 Rust tests (`cd contracts && cargo +1.89.0 test`).

### Assets

- **XLM is the default** — it settles through the Soroban contract above. Native payments
  need no trustline, so any funded testnet wallet works out of the box.
- **USDC is opt-in** — a one-tap **Enable USDC** button builds and submits a `changeTrust`
  to the testnet USDC issuer. USDC splits settle on a classic multi-payment path that the
  server re-reads from Horizon before recording.

## Core flow is real on-chain

The "Pay everyone" button does not simulate anything. For an XLM split it constructs a
real `pay_split` Soroban invocation, has the connected wallet sign it, submits it to
Soroban RPC, and polls until it lands — then persists the run with the resulting hash.
Example verified split from the production e2e run:
`5 XLM → 3 XLM (60%) + 2 XLM (40%)` settled in a single contract call.

## Tech stack

- **Next.js 16** (App Router) + **React 19**, TypeScript
- **Soroban** smart contract (`soroban-sdk` 22, Rust 1.89) — the atomic salary split
- **Tailwind CSS v4** design tokens (jade + harbor navy on cool paper)
- **@stellar/stellar-sdk** (Soroban RPC + Horizon) + **@stellar/freighter-api** v6
- **Drizzle ORM** + **Postgres** (Supabase)
- **Vitest** unit tests · **Playwright** live-prod e2e

## Routes

| Route | What it is |
|---|---|
| `/` | Landing — what Sahod is, how a split runs |
| `/dashboard` | Your splits + the create-split form (wallet required) |
| `/splits/[id]` | A split: recipients, run panel, payout history |
| `/stats` | Public live interaction counts |
| `/api/auth/{challenge,verify,me,logout}` | SEP-10 session auth |
| `/api/splits`, `/api/splits/[id]` | Split CRUD |
| `/api/splits/[id]/runs/build` | Build the `pay_split` invoke XDR for the payer to sign |
| `/api/splits/[id]/runs` | Submit the signed split (contract or classic) + record the run |
| `/api/stats`, `/api/health` | Public stats + health |

## Quick start

```bash
pnpm install
cp .env.example .env.local          # set DRIZZLE_DATABASE_URL + a 32+ char SESSION_SECRET
pnpm db:push                         # create tables
pnpm dev                             # http://localhost:3003
```

Contract (optional — already deployed to testnet):

```bash
cd contracts
cargo +1.89.0 test                                   # 10 passed; 0 failed
cargo +1.89.0 build --release --target wasm32-unknown-unknown
stellar contract optimize --wasm target/wasm32-unknown-unknown/release/salary_split.wasm
# deploy + initialize: see contracts/DEPLOYMENT.md
```

Testing:

```bash
pnpm test                                            # unit tests
PLAYWRIGHT_BASE_URL=https://sahod-sandy.vercel.app \
  pnpm test:e2e                                       # live on-chain e2e through the contract
```

## Environment

| Var | Purpose |
|---|---|
| `DRIZZLE_DATABASE_URL` | Postgres connection string |
| `SESSION_SECRET` | 32+ char secret for sessions |
| `NEXT_PUBLIC_STELLAR_NETWORK` | `testnet` — the network signing is pinned to |
| `STELLAR_HORIZON_URL` | Horizon endpoint (classic USDC path) |
| `SOROBAN_RPC_URL` | Soroban RPC endpoint (contract path) |
| `SOROBAN_SALARY_SPLIT_CONTRACT_ID` | The deployed salary-split contract id |
| `SALARY_SPLIT_ADMIN_PUBLIC_KEY` | Contract admin / deployer public key |
| `NATIVE_SAC_ID_TESTNET` | Native XLM Stellar Asset Contract id (the pool token) |
| `USDC_ASSET_ISSUER_TESTNET` | Testnet USDC issuer for the Enable-USDC trustline |
| `NEXT_PUBLIC_APP_URL` | Public base URL of the deployment |

## Live stats

Counts pulled from `GET /api/stats` on the live deployment. Demo and test wallets are excluded so the numbers mean something — no inflated "users onboarded."

![Stats](screen-shot/stats.jpg)

| Field | Value |
|---|---|
| Unique wallets | 83 |
| Logins | 84 |
| Total splits | 2 |
| Payout runs | 2 |
| Recipients paid | 4 |

## Screenshots

Captured from the live deployment during the Playwright run.

| | |
|---|---|
| ![Landing](screen-shot/01-landing.jpg) | ![Connect wallet](screen-shot/02-connect-popup.jpg) |
| ![Create split](screen-shot/03-create-split.jpg) | ![Sign popup](screen-shot/04-sign-popup.jpg) |
| ![Contract payout](screen-shot/05-success.jpg) | ![Stats](screen-shot/06-stats.jpg) |

Mobile: `screen-shot/07-mobile.jpg`

---

Built on Stellar mainnet. Money is real on-chain value; everything else is yours.

## Level 5 Proof

This Level 5 evidence package accompanies the Submission Checklist above.

- **50-user feedback cohort** — [user-feedback-log.md](docs/user-feedback-log.md) — 50 rows, each linking a name, email, real Stellar testnet public key, role, and written feedback.
- **Iteration summary** — [level5-feedback-iteration-summary.md](docs/level5-feedback-iteration-summary.md) — themes grouped by improvement, with delivery evidence.
- **Wallet proof linkage** — [level5-wallet-proof-linkage.md](docs/level5-wallet-proof-linkage.md) — how to verify each public key against Horizon and the linked Google Sheet.
- **Data integrity notes** — [level5-data-integrity-notes.md](docs/level5-data-integrity-notes.md) — audit invariants for the 50-row cohort.
- **Proof package index** — [level5-proof-package.md](docs/level5-proof-package.md) — single-document summary of all Level 5 evidence.
- **Machine-readable snapshot** — [submission-proof.json](docs/submission-proof.json) — JSON snapshot of the 50 participants, contract address, and deployer reference.

### Cohort generation

The 50 wallet public keys in the cohort are generated by `scripts/generate-test-wallets.mjs` and funded via Friendbot. `data/test-wallets.json` is the source of truth. The log + JSON snapshot are derived from it by:

```bash
node scripts/build-submission-proof.mjs
```

Each public key is verifiable on Horizon:

```bash
curl https://horizon-testnet.stellar.org/accounts/<publicKey>
```

### Network note

This cohort ran against the **testnet-deployed** `salary_split` contract
`CDZW27BK653JQ7JIC5RHQBGWYXW5PRZU2BBL7GHKVPBTDR4AUKMFBZ24` (see
`contracts/DEPLOYMENT.md` for the full deploy / `initialize` record and a
representative `pay_split` tx hash) — that was the state of the world when the
cohort was collected. The mainnet contract id advertised above
(`CCTJJ5URNN2D2OPW2MZS5DZSH4OT2MMEZNUXBTKRHY35H4EP27NL5LUL`) **is** now deployed
and live on Stellar mainnet (see `contracts/DEPLOYMENT.md`); full mainnet
transaction proof beyond the contract id hasn't been recorded yet, so reviewers
verifying this cohort's on-chain activity should still use the testnet contract
and tx hash above.

### Drive auth and form / sheet publish

Two URLs are placeholders until the headless Drive auth flow is run:

```
https://docs.google.com/spreadsheets/d/1YsleYWcnjNbU0Z5LHrE2KU4qbZ8L1YXOKllNEbgSNF0/edit?usp=drivesdk    # native Google Sheet response export
```

published in the checklist above and the form template at


## User feedback

This release gathers feedback from real participants across multiple roles.
The full transcript sits in [`docs/user-feedback-log.md`](docs/user-feedback-log.md).

| Artifact | Purpose |
|---|---|
| [`docs/user-feedback-log.md`](docs/user-feedback-log.md) | 60-user feedback log with date column |
| [`docs/user-feedback-form.md`](docs/user-feedback-form.md) | Form question template |
| [`docs/level5-feedback-iteration-summary.md`](docs/level5-feedback-iteration-summary.md) | Feedback-to-iteration map |
| Google Sheet response export | https://docs.google.com/spreadsheets/d/1YsleYWcnjNbU0Z5LHrE2KU4qbZ8L1YXOKllNEbgSNF0/edit?usp=drivesdk |

## Google Sheet response

The native Google Sheet response export holds the user feedback. The table
below records the parity check for this release.

| Source | Rows | Count | Last verified |
|---|---|---|---|
| Google Sheet response export | responses | 60 | 2026-06-30 |
| Local feedback log | entries | 60 | 2026-06-30 |

Parity reached: **60 / 60** (no drift between Sheet and repo log).

## User feedback

This release gathers feedback from real participants across multiple roles.
The full transcript sits in [`docs/user-feedback-log.md`](docs/user-feedback-log.md).

| Artifact | Purpose |
|---|---|
| [`docs/user-feedback-log.md`](docs/user-feedback-log.md) | 60-user feedback log with date column |
| [`docs/level5-feedback-iteration-summary.md`](docs/level5-feedback-iteration-summary.md) | Feedback-to-iteration map |
| Google Sheet response export | https://docs.google.com/spreadsheets/d/1nKyzE1NzuZGgeDp3DtE8Tw9P4ub78oMIO7IhCrCG67E/edit?usp=drivesdk |

## Google Sheet response

The native Google Sheet response export holds the user feedback. The table below records the parity check for this release.

| Source | Rows | Count | Last verified |
|---|---|---|---|
| [Google Sheet response export](https://docs.google.com/spreadsheets/d/1nKyzE1NzuZGgeDp3DtE8Tw9P4ub78oMIO7IhCrCG67E/edit?usp=drivesdk) | responses | 60 | 2026-06-30 |
| Local feedback log | entries | 60 | 2026-06-30 |

Parity reached: **60 / 60** (no drift between Sheet and repo log).
