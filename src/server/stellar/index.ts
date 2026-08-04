/**
 * Sahod's internal Stellar module. One clean import surface for the app:
 *
 *   network.ts   — passphrase / Horizon / Soroban RPC / contract id + SAC config
 *   contract.ts  — salary-split Soroban glue (build / submit / read pay_split)
 *   horizon.ts   — classic on-chain verification for the opt-in USDC path
 */

export * from './contract';
export * from './horizon';
export * from './network';
