#!/usr/bin/env bash
# Gece yedeği: PostgreSQL dökümü → yedek bucket'ı (YEDEK_S3_*). Saklama: YEDEK_SAKLAMA_GUN (varsayılan 30).
# Sunucuda cron ile çalışır (belgeler/isletim.md). Elle: ./deploy/yedekle.sh
set -euo pipefail
cd "$(dirname "$0")/.."

COMPOSE="docker compose -f compose.sunucu.yaml"
ZAMAN=$(date -u +%Y%m%dT%H%M%SZ)
DOSYA="kliplan-${ZAMAN}.dump"
mkdir -p deploy/yedekler

# Özel biçim (-Fc): sıkıştırılmış, pg_restore ile seçerek geri yüklenebilir. Sunucu sürümüyle aynı pg_dump kullanılır.
$COMPOSE exec -T postgres pg_dump -U kliplan -d kliplan -Fc > "deploy/yedekler/${DOSYA}"
test -s "deploy/yedekler/${DOSYA}"

$COMPOSE run --rm --no-deps -v "$(pwd)/deploy/yedekler:/yedekler:ro" worker npm run --silent yedek -- yukle "/yedekler/${DOSYA}"

# Sunucuda yalnızca son 7 günün kopyası kalır; asıl saklama yedek bucket'ında.
find deploy/yedekler -name 'kliplan-*.dump' -mtime +7 -delete
echo "✓ Yedek tamam: ${DOSYA}"
