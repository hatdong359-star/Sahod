export const dynamic = 'force-dynamic';

import type { NextRequest } from 'next/server';
import { ok } from '@/server/lib/http';
import { compose } from '@/server/middleware/compose';
import { withError } from '@/server/middleware/withError';
import { statsService } from '@/server/service/stats.service';

async function getStats(_req: NextRequest) {
  const stats = await statsService.global();
  return ok(stats);
}

export const GET = compose(withError)(getStats);
