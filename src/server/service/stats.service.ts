import { sql } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { payoutLines, payoutRuns, sessions, splits } from '@/server/db/schema';
import { env } from '@/server/config/env';

function excludedKeys(): string[] {
  return (env.STATS_EXCLUDE_KEYS ?? '')
    .split(',')
    .map((k) => k.trim())
    .filter((k) => k.length > 0);
}

export const statsService = {
  /** Public, real interaction counts drawn from sessions + core entities. */
  async global() {
    const excluded = excludedKeys();

    const uniqueWalletsQuery = db
      .select({
        uniqueWallets: sql<number>`count(distinct ${sessions.publicKey})`,
        logins: sql<number>`count(*)`,
      })
      .from(sessions);
    const totalSplitsQuery = db.select({ totalSplits: sql<number>`count(*)` }).from(splits);
    const payoutRunsQuery = db
      .select({ payoutRunsCount: sql<number>`count(*)` })
      .from(payoutRuns);
    const recipientsPaidQuery = db
      .select({ recipientsPaid: sql<number>`count(*)` })
      .from(payoutLines);

    if (excluded.length > 0) {
      const keys = sql.join(
        excluded.map((k) => sql`${k}`),
        sql.raw(', '),
      );
      uniqueWalletsQuery.where(sql`${sessions.publicKey} NOT IN (${keys})`);
      totalSplitsQuery.where(sql`${splits.publicKey} NOT IN (${keys})`);
      payoutRunsQuery.where(sql`${payoutRuns.publicKey} NOT IN (${keys})`);
      recipientsPaidQuery.where(sql`${payoutLines.runId} IN (SELECT id FROM sahod_payout_runs WHERE public_key NOT IN (${keys}))`);
    }

    const [{ uniqueWallets, logins }] = await uniqueWalletsQuery;
    const [{ totalSplits }] = await totalSplitsQuery;
    const [{ payoutRunsCount }] = await payoutRunsQuery;
    const [{ recipientsPaid }] = await recipientsPaidQuery;

    return {
      uniqueWallets: Number(uniqueWallets) || 0,
      logins: Number(logins) || 0,
      totalSplits: Number(totalSplits) || 0,
      payoutRuns: Number(payoutRunsCount) || 0,
      recipientsPaid: Number(recipientsPaid) || 0,
    };
  },
};
