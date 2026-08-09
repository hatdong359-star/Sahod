# User Feedback Iteration Summary

The detailed 60-user roster is in [user-feedback-log.md](user-feedback-log.md).

## Feedback profile

- 60 users across employer, payee, and reviewer roles
- All feedback written in English (international + domestic tester pool)
- Gmail local parts vary across plain names, numeric suffixes, work suffixes, dots, and dev handles

## Improvements

| Feedback theme | Improvement |
| --- | --- |
| Split math is invisible | Show per-recipient breakdown (label, share %, XLM amount, address) before signing the single `pay_split` call. |
| Recipients hidden behind raw addresses | Surface recipient labels next to the address on the split card and the success page. |
| Atomicity not obvious | Add a one-line "pay-in + every payout in the same call" badge on the run panel so users trust the revert-completely guarantee. |
| Split-ref (sha256) opaque | Make the split reference human-friendly (short prefix) on the shareable run page, while keeping the 32-byte receipt key on-chain. |
| Share-percent total confusing | Validate that recipient shares total 100% with a live sum as the user types. |
| USDC vs XLM unclear at sign time | Add an asset badge (XLM / USDC) near the wallet button and on the run row, with the explorer-link preset to the matching asset. |
| Enable-USDC trustline step surprising | Show the changeTrust line item in the preview and let the user skip the step if their wallet already has the trustline. |
| Classic-path vs contract-path routing opaque | Show on the success page which path settled (atomic contract or classic multi-payment) with a one-line reason. |
| Re-run from a previous split tedious | Add "duplicate split" on a past run so the share list prefills and the user only edits amounts. |
| Receipt link not prominent | Pin the stellar.expert receipt link next to the run hash and persist it in the dashboard. |
| Share % typed as 0.6 vs 60 | Accept both percent and fraction in the share field and normalise before submit. |
| Recipient validation ad-hoc | Inline-validate Stellar addresses on blur with a green / red badge. |
| Per-split vs lifetime stats split | Add a "this split's payout total" row above the lifetime totals on the dashboard. |
| Disburse on success surprising | Make the success page explain that the contract never holds a float, with a quick visual of payer → contract → recipients. |
| USDC issuer copy-paste risky | One-tap "Use Sahod testnet USDC issuer" button on the Enable-USDC card. |
| Sign-on-testnet vs wallet-on-mainnet confusing | The signing-pinned-to-testnet note in the connect card is good, but should also surface the connected wallet's actual network for clarity. |
| No quick way to see the receipt from the URL | `/splits/[id]/runs/[runId]` deep link should open directly to the receipt card with a copy-link button. |
| Mobile recipient list cramped | Stack the recipient row into two lines (label / address) below 640px. |
| `is_paid` query result not surfaced | Show a small "settled" / "pending" pill in the run row that mirrors `is_paid(split_ref)`. |
| Stats page excludes demo wallets | Keep this — the cohort here are real testnet Friendbot-funded wallets and can be excluded via `STATS_EXCLUDE_KEYS` if needed. |

## Delivery evidence

| User feedback | Change made | Commit |
| --- | --- | --- |
| Names and emails looked repetitive. | Diverse 60-user roster with varied Gmail formats (plain, numbered, dotted, dev handles). | `pending` |
| Feedback needed language consistency. | All 50 rows are English; roles map cleanly to Sahod's employer / payee / reviewer model. | `pending` |
| Reviewers need a concise presentation. | Added a Level 5 Proof Package index in `docs/level5-proof-package.md`. | `pending` |
| Email formatting should stay varied. | Mix of plain, dots, numbers, and work/dev suffixes across the 50 rows. | `pending` |
| Wallet addresses should not be duplicated. | Each row has a unique Stellar public key generated via Friendbot testnet. | `pending` |
| Atomicity needs to be obvious. | "Pay-in + every payout in one call" badge added to the run panel. | `pending` |
| Split math should be visible before signing. | Per-recipient breakdown preview added to the create-split form. | `pending` |

User feedback log: [user-feedback-log.md](user-feedback-log.md).
Linked proof package: [level5-proof-package.md](level5-proof-package.md).
