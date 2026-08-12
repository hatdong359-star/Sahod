export const dynamic = 'force-dynamic';

import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { ok } from '@/server/lib/http';
import type { HandlerContext } from '@/server/middleware/compose';
import { compose } from '@/server/middleware/compose';
import { withAuth } from '@/server/middleware/withAuth';
import { withError } from '@/server/middleware/withError';
import { withRateLimit } from '@/server/middleware/withRateLimit';
import { splitService } from '@/server/service/split.service';

const buildSchema = z.object({
  totalAmount: z
    .string()
    .trim()
    .refine((v) => Number(v) > 0, 'Amount must be greater than zero'),
});

async function buildRun(req: NextRequest, ctx: HandlerContext) {
  const params = await ctx.params;
  const id = params?.id as string;
  const { totalAmount } = buildSchema.parse(await req.json());
  const built = await splitService.buildRun(id, ctx.publicKey as string, totalAmount);
  return ok(built);
}

export const POST = compose(withError, withRateLimit, withAuth)(buildRun);