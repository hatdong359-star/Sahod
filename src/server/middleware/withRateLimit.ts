import { AppError } from '@/server/lib/http';
import type { Middleware } from './compose';

type Bucket = { tokens: number; lastRefill: number };

const buckets = new Map<string, Bucket>();
const CAPACITY = 20;
const REFILL_PER_SEC = 2;
const IDLE_TTL_MS = 10 * 60 * 1000;
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

function sweepIdleBuckets(now: number): void {
  for (const [key, bucket] of buckets) {
    if (now - bucket.lastRefill > IDLE_TTL_MS) {
      buckets.delete(key);
    }
  }
}

if (typeof globalThis.setInterval === 'function') {
  const sweepTimer = (globalThis as { __sahodRateLimitSweep?: NodeJS.Timeout })
    .__sahodRateLimitSweep;
  if (!sweepTimer) {
    const handle = setInterval(() => sweepIdleBuckets(Date.now()), SWEEP_INTERVAL_MS);
    if (typeof handle.unref === 'function') handle.unref();
    (globalThis as { __sahodRateLimitSweep?: NodeJS.Timeout }).__sahodRateLimitSweep = handle;
  }
}

function take(key: string): boolean {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { tokens: CAPACITY, lastRefill: now };
  const elapsed = (now - bucket.lastRefill) / 1000;
  bucket.tokens = Math.min(CAPACITY, bucket.tokens + elapsed * REFILL_PER_SEC);
  bucket.lastRefill = now;
  if (bucket.tokens < 1) {
    buckets.set(key, bucket);
    return false;
  }
  bucket.tokens -= 1;
  buckets.set(key, bucket);
  return true;
}

export const withRateLimit: Middleware = (handler) => async (req, ctx) => {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anon';
  if (!take(ip)) {
    throw new AppError('RATE_LIMITED', 'Too many requests — slow down a moment', 429);
  }
  return handler(req, ctx);
};
