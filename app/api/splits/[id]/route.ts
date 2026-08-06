export const dynamic = 'force-dynamic';

import type { NextRequest } from 'next/server';
import { ok } from '@/server/lib/http';
import type { HandlerContext } from '@/server/middleware/compose';
import { compose } from '@/server/middleware/compose';
import { withAuth } from '@/server/middleware/withAuth';
import { withError } from '@/server/middleware/withError';
import { splitService } from '@/server/service/split.service';

async function getSplit(_req: NextRequest, ctx: HandlerContext) {
  const params = await ctx.params;
  const id = params?.id as string;
  const split = await splitService.getOwned(id, ctx.publicKey as string);
  return ok(split);
}

export const GET = compose(withError, withAuth)(getSplit);
