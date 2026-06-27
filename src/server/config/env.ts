import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  NEXT_PUBLIC_APP_NAME: z.string().default('Sahod'),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3003'),

  DRIZZLE_DATABASE_URL: z.string().url(),

  STELLAR_NETWORK: z.enum(['testnet', 'public', 'futurenet']).default('testnet'),
  NEXT_PUBLIC_STELLAR_NETWORK: z.enum(['testnet', 'public', 'futurenet']).default('testnet'),
  STELLAR_HORIZON_URL: z.string().url().default('https://horizon-testnet.stellar.org'),
  STELLAR_NETWORK_PASSPHRASE: z.string().default('Test SDF Network ; September 2015'),
  SOROBAN_RPC_URL: z.string().url().default('https://soroban-testnet.stellar.org'),

  // Salary-split Soroban contract (atomic pay-in + fan-out for XLM splits).
  SOROBAN_SALARY_SPLIT_CONTRACT_ID: z
    .string()
    .default('CDZW27BK653JQ7JIC5RHQBGWYXW5PRZU2BBL7GHKVPBTDR4AUKMFBZ24'),
  NEXT_PUBLIC_SALARY_SPLIT_CONTRACT_ID: z
    .string()
    .default('CDZW27BK653JQ7JIC5RHQBGWYXW5PRZU2BBL7GHKVPBTDR4AUKMFBZ24'),
  SALARY_SPLIT_ADMIN_PUBLIC_KEY: z
    .string()
    .default('GBL5RJKF4QNJ4ZPLJZ7PS7K5A4J44VEZJRV2CRTFFDRVSY2N76AIIE47'),
  // Native XLM Stellar Asset Contract (SAC) the split pool moves. No trustline.
  NATIVE_SAC_ID_TESTNET: z
    .string()
    .default('CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC'),

  USDC_ASSET_CODE: z.string().default('USDC'),
  USDC_ASSET_ISSUER_TESTNET: z
    .string()
    .default('GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'),
  // Optional keys excluded from public stats (seed / internal demo wallets).
  STATS_EXCLUDE_KEYS: z.string().optional(),

  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 chars'),
  SESSION_COOKIE_NAME: z.string().default('sahod_session'),
  SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(604800),
  NONCE_TTL_SECONDS: z.coerce.number().int().positive().default(300),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment variables');
}

const rawEnv = parsed.data;

/** Resolved USDC issuer for the active Stellar network. */
export const USDC_ASSET_ISSUER_VALUE: string = rawEnv.USDC_ASSET_ISSUER_TESTNET;

/** Native XLM SAC id for the active network (the contract's pool token). */
export const NATIVE_SAC_ID_VALUE: string = rawEnv.NATIVE_SAC_ID_TESTNET;

export const env = rawEnv;
export type Env = typeof env;
