#!/bin/bash
set -e
# amber-sagar Railway deploy
# Run: railway login && bash deploy.sh

echo "=== Deploying amber-sagar to Railway ==="

railway init --name "amber-sagar"
railway service --name "amber-sagar-agent"

railway variables set \
  ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:?Set ANTHROPIC_API_KEY}" \
  GITHUB_TOKEN="${GITHUB_TOKEN:?Set GITHUB_TOKEN}" \
  LOOP_API_KEY="${LOOP_API_KEY:?Set LOOP_API_KEY — get from app.loopmessage.com}" \
  LOOP_SENDER_ID="${LOOP_SENDER_ID:?Set LOOP_SENDER_ID — Sagar's sender UUID}" \
  SAGAR_PHONE_NUMBER="${SAGAR_PHONE_NUMBER:?Set SAGAR_PHONE_NUMBER in E.164 format}" \
  GITHUB_MESSAGES_REPO="calebnewtonusc/sagar-amber-messages" \
  GITHUB_CONTEXT_REPO="calebnewtonusc/sagar-context"

railway up --detach
echo "=== Deployed! ==="
echo "Set webhook in Loop Message dashboard → $(railway domain)/webhook"
