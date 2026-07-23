#!/usr/bin/env bash
# One-shot Openfort Shield setup for LIVE mode (Base mainnet go-live).
#
# Registers a FRESH Shield project for live (kept separate from the test-mode
# Shield project so testnet wallets never mix with real ones), links it to the
# LIVE publishable key, then wires every secret/env var WITHOUT printing them.
#
# Run from the repo root:  bash scripts/setup-openfort-shield-live.sh
set -euo pipefail

OPENFORT_PK="pk_live_c812f4b0-b5f4-551e-8542-6003e01ec1cb"
SUPABASE_REF="qplmmxynzxzkfxtayoqr"

fingerprint() { printf '%s' "$1" | shasum -a 256 | cut -c1-12; }

echo "==> Registering fresh LIVE Shield project…"
RESP=$(curl -sf --max-time 20 -X POST https://shield.openfort.io/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Moodeng Credit Live","generate_encryption_key":true}')

SHIELD_PK=$(python3 -c "import json,sys; print(json.loads(sys.argv[1])['api_key'])" "$RESP")
SHIELD_SECRET=$(python3 -c "import json,sys; print(json.loads(sys.argv[1])['api_secret'])" "$RESP")
SHIELD_SHARE=$(python3 -c "import json,sys; d=json.loads(sys.argv[1]); print(d.get('encryption_part') or d.get('encryption_key') or '')" "$RESP")

if [ -z "$SHIELD_PK" ] || [ -z "$SHIELD_SECRET" ] || [ -z "$SHIELD_SHARE" ]; then
  echo "!! Shield register response missing fields — raw keys NOT printed."
  echo "   Fields present:"; python3 -c "import json,sys; print(list(json.loads(sys.argv[1]).keys()))" "$RESP"
  exit 1
fi
echo "    api_key       sha256:$(fingerprint "$SHIELD_PK")"
echo "    api_secret    sha256:$(fingerprint "$SHIELD_SECRET")"
echo "    encr. share   sha256:$(fingerprint "$SHIELD_SHARE")"

echo "==> Linking LIVE Openfort provider (publishable key) to the Shield project…"
curl -sf --max-time 20 -X POST https://shield.openfort.io/project/providers \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $SHIELD_PK" -H "X-API-Secret: $SHIELD_SECRET" \
  -d "{\"providers\":{\"openfort\":{\"publishable_key\":\"$OPENFORT_PK\"}}}" >/dev/null \
  && echo "    linked." || { echo "!! provider link failed — continuing (SDK may still link implicitly)"; }

echo "==> Setting Supabase edge-fn secrets ($SUPABASE_REF)…"
supabase secrets set \
  "OPENFORT_SHIELD_PUBLISHABLE_KEY=$SHIELD_PK" \
  "OPENFORT_SHIELD_SECRET_KEY=$SHIELD_SECRET" \
  "OPENFORT_SHIELD_ENCRYPTION_SHARE=$SHIELD_SHARE" \
  --project-ref "$SUPABASE_REF"

echo "==> Encrypting VITE_OPENFORT_SHIELD_PUBLISHABLE_KEY into .env.staging…"
npx dotenvx set VITE_OPENFORT_SHIELD_PUBLISHABLE_KEY "$SHIELD_PK" -f .env.staging

echo
echo "All done. Nothing sensitive was printed above (fingerprints only)."
echo "The live encryption share exists ONLY in Supabase secrets now — the test-mode"
echo "Shield project and its wallets are untouched (separate project)."
