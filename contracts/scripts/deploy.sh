#!/usr/bin/env bash
# Usage: ./scripts/deploy.sh [testnet|public]
# Requires: a configured `deployer` identity (stellar keys add deployer ...).
set -euo pipefail
NETWORK="${1:-testnet}"
WASM="target/wasm32-unknown-unknown/release/salary_split.optimized.wasm"

stellar contract deploy \
  --wasm "$WASM" \
  --source deployer \
  --network "$NETWORK"
