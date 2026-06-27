import { sql } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { payoutLines, payoutRuns, sessions, splits } from '@/server/db/schema';

export const statsService = {
  /** Public, real interaction counts drawn from sessions + core entities. */
  async global() {
    const [{ uniqueWallets, logins }] = await db
      .select({
        uniqueWallets: sql<number>`count(distinct ${sessions.publicKey})`,
        logins: sql<number>`count(*)`,
      })
      .from(sessions);

    const [{ totalSplits }] = await db.select({ totalSplits: sql<number>`count(*)` }).from(splits);

    const [{ payoutRunsCount }] = await db
      .select({ payoutRunsCount: sql<number>`count(*)` })
      .from(payoutRuns);

    const [{ recipientsPaid }] = await db
      .select({ recipientsPaid: sql<number>`count(*)` })
      .from(payoutLines);

    return {
      uniqueWallets: Number(uniqueWallets) || 0,
      logins: Number(logins) || 0,
      totalSplits: Number(totalSplits) || 0,
      payoutRuns: Number(payoutRunsCount) || 0,
      recipientsPaid: Number(recipientsPaid) || 0,
    };
  },
};
