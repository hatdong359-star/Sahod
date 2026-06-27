import { index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { splits } from './splits';

/**
 * One execution of a split: a single on-chain Stellar transaction that paid every
 * recipient at once. `txHash` is the real, verified Horizon transaction hash.
 */
export const payoutRuns = pgTable(
  'payout_runs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    splitId: uuid('split_id')
      .notNull()
      .references(() => splits.id, { onDelete: 'cascade' }),
    publicKey: text('public_key').notNull(),
    asset: text('asset').notNull().default('XLM'),
    totalAmount: text('total_amount').notNull(),
    txHash: text('tx_hash').notNull().unique(),
    /** 'contract' = atomic Soroban pay_split; 'classic' = multi-payment (USDC). */
    mode: text('mode').notNull().default('contract'),
    network: text('network').notNull().default('testnet'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    splitIdx: index('runs_split_idx').on(t.splitId),
    ownerIdx: index('runs_owner_idx').on(t.publicKey),
  }),
);

/** Per-recipient line of a payout run — the exact amount each address received. */
export const payoutLines = pgTable(
  'payout_lines',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    runId: uuid('run_id')
      .notNull()
      .references(() => payoutRuns.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    address: text('address').notNull(),
    sharePct: integer('share_pct').notNull(),
    amount: text('amount').notNull(),
  },
  (t) => ({ runIdx: index('lines_run_idx').on(t.runId) }),
);

export type PayoutRun = typeof payoutRuns.$inferSelect;
export type NewPayoutRun = typeof payoutRuns.$inferInsert;
export type PayoutLine = typeof payoutLines.$inferSelect;
export type NewPayoutLine = typeof payoutLines.$inferInsert;
