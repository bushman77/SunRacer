#!/usr/bin/env bash
# Opt-in TLS-only LAN smoke test, reuses existing Galaxy-trusted mkcert cert.
set -euo pipefail

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cert="${SUNRACER_SBS_CERT:-$repo/apps/sunracer_web/priv/cert/localhost.pem}"
key="${SUNRACER_SBS_KEY:-$repo/apps/sunracer_web/priv/cert/localhost-key.pem}"
host="${SUNRACER_DEV_LAN_HOST:-}"
if [[ -z "$host" ]]; then
  host="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src") {print $(i+1); exit}}')"
fi
if [[ -z "$host" ]]; then
  echo "Unable to discover LAN IP. Set SUNRACER_DEV_LAN_HOST=your-private-IP." >&2
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
export SUNRACER_SBS_BIND="${SUNRACER_SBS_BIND:-$host:4455}"
export SUNRACER_SBS_CERT="$cert"
export SUNRACER_SBS_KEY="$key"
echo "SunRacer: opt-in HTTPS relay proof configured at ${SUNRACER_SBS_BIND}"
echo "In the native game: open PILOT HMD, then scan its single QR with the S21."
echo "No world-state relay or asset server is enabled by this stage."
cd "$repo/clients/tauri"
exec npm run dev
