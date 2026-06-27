export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { created } from '@/server/lib/http';
import type { HandlerContext } from '@/server/middleware/compose';
import { compose } from '@/server/middleware/compose';
import { withAuth } from '@/server/middleware/withAuth';
import { withError } from '@/server/middleware/withError';
import { splitService } from '@/server/service/split.service';

const amount = z
  .string()
  .trim()
  .refine((v) => Number(v) > 0, 'Amount must be greater than zero');

// Atomic contract path: submit the payer-signed pay_split invoke.
const contractSchema = z.object({
  signedXdr: z.string().trim().min(1, 'A signed transaction is required'),
  totalAmount: amount,
});

// Classic (opt-in USDC) path: record a verified multi-payment tx hash.
const classicSchema = z.object({
  txHash: z.string().trim().min(40, 'A valid transaction hash is required'),
  totalAmount: amount,
});

async function recordRun(req: NextRequest, ctx: HandlerContext) {
  const params = await ctx.params;
  const id = params?.id as string;
  const publicKey = ctx.publicKey as string;
  const raw = await req.json();

  if (typeof raw?.signedXdr === 'string') {
    const body = contractSchema.parse(raw);
    return created(await splitService.submitContractRun(id, publicKey, body));
  }
  const body = classicSchema.parse(raw);
  return created(await splitService.recordRun(id, publicKey, body));
}

export const POST = compose(withError, withAuth)(recordRun);
