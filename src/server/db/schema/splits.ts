import { index, integer, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const SPLIT_ASSETS = ['XLM', 'USDC'] as const;
export type SplitAsset = (typeof SPLIT_ASSETS)[number];
export const splitAssetEnum = pgEnum('split_asset', SPLIT_ASSETS);

/**
 * A salary split — a reusable plan that fans one incoming paycheck out to a set
 * of recipients by percentage. Owned by the connecting wallet (publicKey).
 */
export const splits = pgTable(
  'splits',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    publicKey: text('public_key').notNull(),
    name: text('name').notNull(),
    asset: splitAssetEnum('asset').notNull().default('XLM'),
    network: text('network').notNull().default('testnet'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ ownerIdx: index('splits_owner_idx').on(t.publicKey) }),
);

/** A destination on a split: a label + Stellar address + share of the paycheck. */
export const recipients = pgTable(
  'recipients',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    splitId: uuid('split_id')
      .notNull()
      .references(() => splits.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    address: text('address').notNull(),
    sharePct: integer('share_pct').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ splitIdx: index('recipients_split_idx').on(t.splitId) }),
);

export type Split = typeof splits.$inferSelect;
export type NewSplit = typeof splits.$inferInsert;
export type Recipient = typeof recipients.$inferSelect;
export type NewRecipient = typeof recipients.$inferInsert;
