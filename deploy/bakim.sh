#!/usr/bin/env bash
# Gece bakımı: saklama süresi dolan verileri siler (belgeler/isletim.md → Saklama süreleri). Elle denemek için --uygula olmadan çalıştırın.
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose -f compose.sunucu.yaml run --rm --no-deps worker npm run --silent temizlik -- "$@"
