#!/usr/bin/env bash
# Opt-in TLS-only LAN smoke test, reuses existing Galaxy-trusted mkcert cert.
set -euo pipefail

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cert="${SPACE_NOVA_SBS_CERT:-$repo/apps/darkorbit_web/priv/cert/localhost.pem}"
key="${SPACE_NOVA_SBS_KEY:-$repo/apps/darkorbit_web/priv/cert/localhost-key.pem}"
host="${DARKORBIT_DEV_LAN_HOST:-}"
if [[ -z "$host" ]]; then
  host="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src") {print $(i+1); exit}}')"
fi
if [[ -z "$host" ]]; then
  echo "Unable to discover LAN IP. Set DARKORBIT_DEV_LAN_HOST=your-private-IP." >&2
  exit 1
fi
if [[ ! -f "$cert" || ! -f "$key" ]]; then
  echo "Missing trusted local cert/key at $cert / $key." >&2
  echo "Generate with mkcert including your LAN IP, and trust the CA on your phone." >&2
  exit 1
fi
if ! openssl x509 -in "$cert" -noout -checkip "$host" | grep -q "does match certificate"; then
  echo "Certificate does not cover LAN IP $host. Recreate the mkcert cert." >&2
  exit 1
fi
export SPACE_NOVA_SBS_BIND="${SPACE_NOVA_SBS_BIND:-$host:4455}"
export SPACE_NOVA_SBS_CERT="$cert"
export SPACE_NOVA_SBS_KEY="$key"
echo "Space Nova: opt-in HTTPS relay proof configured at ${SPACE_NOVA_SBS_BIND}"
echo "In the native game: open PILOT HMD, then scan its single QR with the S21."
echo "No world-state relay or asset server is enabled by this stage."
cd "$repo/clients/tauri"
exec npm run dev
