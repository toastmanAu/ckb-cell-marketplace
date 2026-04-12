#!/usr/bin/env bash
set -euo pipefail

# Deploy market-item-type to CKB testnet
# Usage: ./scripts/deploy-testnet.sh

BINARY="build/market-item-type"
CKB_CLI=${CKB_CLI:-ckb-cli}
RPC_URL=${RPC_URL:-"https://testnet.ckb.dev/rpc"}

if [ ! -f "$BINARY" ]; then
    echo "Binary not found at $BINARY — run 'make build' first"
    exit 1
fi

SIZE=$(stat -c%s "$BINARY")
MIN_CAPACITY=$(( SIZE + 74 ))

echo "=== market-item-type Testnet Deployment ==="
echo ""
echo "Binary:   $BINARY ($SIZE bytes)"
echo "RPC:      $RPC_URL"
echo "Min CKB:  $MIN_CAPACITY"
echo ""
echo "Step 1: Generate deployment transaction"
echo "  $CKB_CLI deploy gen-txs \\"
echo "    --deployment-config scripts/deployment.toml \\"
echo "    --migration-dir deploy/ \\"
echo "    --info-file deploy/deployment-info.json \\"
echo "    --api-url $RPC_URL"
echo ""
echo "Step 2: Sign"
echo "  $CKB_CLI deploy sign-txs \\"
echo "    --info-file deploy/deployment-info.json \\"
echo "    --api-url $RPC_URL"
echo ""
echo "Step 3: Send"
echo "  $CKB_CLI deploy apply-txs \\"
echo "    --info-file deploy/deployment-info.json \\"
echo "    --api-url $RPC_URL"
echo ""
echo "After deployment, record the type_id hash from deployment-info.json"
echo "— that hash is what the frontend uses to identify MarketItem cells."
