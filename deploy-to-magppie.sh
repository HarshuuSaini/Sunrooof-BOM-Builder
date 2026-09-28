#!/bin/bash
# One-shot deploy of the Sunrooof BOM Builder to the Magppie Silverstone Vercel team.
# Usage:  ./deploy-to-magppie.sh  <YOUR_VERCEL_TOKEN>
set -e
TOKEN="$1"
if [ -z "$TOKEN" ]; then echo "Usage: ./deploy-to-magppie.sh <VERCEL_TOKEN>"; exit 1; fi

cd "$(dirname "$0")"
# Unlink the old (khalsasharan) project so a fresh one is created under Magppie
[ -d .vercel ] && mv .vercel .vercel.bak.$(date +%s)

echo "▲ Deploying to Magppie Silverstone (production)…"
vercel deploy --prod --yes \
  --token="$TOKEN" \
  --scope=magppiesilverstonepvtltd \
  --name=sunrooof-bomb-builder
