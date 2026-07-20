import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['@stellar/stellar-sdk'],
};

export default nextConfig;
