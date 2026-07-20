import { Asset, Networks } from '@stellar/stellar-sdk';
import { env, NATIVE_SAC_ID_VALUE, USDC_ASSET_ISSUER_VALUE } from '@/server/config/env';
import type { SplitAsset } from '@/server/db/schema/splits';

/**
 * Single source of truth for everything network-shaped: passphrase, Horizon and
 * Soroban RPC endpoints, the explorer slug, the salary-split contract id, and
 * the asset contracts (SAC) the split moves. Every other Stellar helper here
 * derives from this module.
 */
const PASSPHRASE_BY_NETWORK = {
  testnet: Networks.TESTNET,
  public: Networks.PUBLIC,
  futurenet: Networks.FUTURENET,
} as const;

export const network = {
  id: env.STELLAR_NETWORK,
  passphrase: env.STELLAR_NETWORK_PASSPHRASE || PASSPHRASE_BY_NETWORK[env.STELLAR_NETWORK],
  horizonUrl: env.STELLAR_HORIZON_URL,
  rpcUrl: env.SOROBAN_RPC_URL,
  explorerSlug: env.STELLAR_NETWORK === 'public' ? 'public' : 'testnet',
} as const;

export const contractIds = {
  salarySplit: env.SOROBAN_SALARY_SPLIT_CONTRACT_ID,
  nativeSac: NATIVE_SAC_ID_VALUE,
  admin: env.SALARY_SPLIT_ADMIN_PUBLIC_KEY,
} as const;

export function getNetworkPassphrase(): string {
  return network.passphrase;
}

export function resolveAsset(code: SplitAsset): Asset {
  if (code === 'XLM') return Asset.native();
  return new Asset(env.USDC_ASSET_CODE, USDC_ASSET_ISSUER_VALUE);
}
