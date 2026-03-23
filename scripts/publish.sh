#!/usr/bin/env bash
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
gh repo create bountyboard --public \
  --description "BountyBoard — On-chain task rewards with XLM escrow on Stellar Soroban" \
  --source "${ROOT}" --remote origin --push
ENV="${ROOT}/frontend/.env"
CONTRACT_ID=$(grep VITE_CONTRACT_ID "$ENV" | cut -d= -f2)
XLM_TOKEN=$(grep VITE_XLM_TOKEN "$ENV" | cut -d= -f2)
USER=$(gh api user -q .login)
gh secret set VITE_CONTRACT_ID --body "$CONTRACT_ID" --repo "$USER/bountyboard"
gh secret set VITE_XLM_TOKEN   --body "$XLM_TOKEN"   --repo "$USER/bountyboard"
cd "${ROOT}/frontend" && vercel --prod --yes
echo "✓ BountyBoard published!"
