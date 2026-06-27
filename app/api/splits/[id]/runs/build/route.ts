export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { ok } from '@/server/lib/http';
import type { HandlerContext } from '@/server/middleware/compose';
import { compose } from '@/server/middleware/compose';
import { withAuth } from '@/server/middleware/withAuth';
import { withError } from '@/server/middleware/withError';
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
  const body = buildSchema.parse(await req.json());
  const result = await splitService.buildRun(id, ctx.publicKey as string, body.totalAmount);
  return ok(result);
}

export const POST = compose(withError, withAuth)(buildRun);
