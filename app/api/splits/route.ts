export const dynamic = 'force-dynamic';

import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { created, ok } from '@/server/lib/http';
import type { HandlerContext } from '@/server/middleware/compose';
import { compose } from '@/server/middleware/compose';
import { withAuth } from '@/server/middleware/withAuth';
import { withError } from '@/server/middleware/withError';
import { splitService } from '@/server/service/split.service';

const recipientSchema = z.object({
  label: z.string().trim().min(1, 'Recipient label is required').max(40),
  address: z.string().trim().length(56, 'A Stellar address is 56 characters'),
  sharePct: z.number().int().min(1).max(100),
});

const createSchema = z.object({
  name: z.string().trim().min(1, 'Name your split').max(48),
  asset: z.enum(['XLM', 'USDC']).default('XLM'),
  recipients: z.array(recipientSchema).min(2).max(20),
});

async function listSplits(_req: NextRequest, ctx: HandlerContext) {
  const splits = await splitService.listByOwner(ctx.publicKey as string);
  return ok({ splits });
}

async function createSplit(req: NextRequest, ctx: HandlerContext) {
  const body = createSchema.parse(await req.json());
  const split = await splitService.create(ctx.publicKey as string, body);
  return created(split);
}

export const GET = compose(withError, withAuth)(listSplits);
export const POST = compose(withError, withAuth)(createSplit);
