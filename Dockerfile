# Web paneli ve worker için ortak imaj (Faz 6.8). Kurulum: belgeler/kurulum.md
# Remotion'ın Docker önerisi: Debian tabanlı imaj (Alpine değil), Chrome kütüphaneleri ve derlemede `remotion browser ensure`.
FROM node:24-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates libnss3 libdbus-1-3 libatk1.0-0 libgbm-dev libasound2 libxrandr2 libxkbcommon-dev \
    libxfixes3 libxcomposite1 libxdamage1 libatk-bridge2.0-0 libpango-1.0-0 libcairo2 libcups2 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Bağımlılıklar kaynak koddan önce kurulur; kod değişince bu katman yeniden kullanılır.
COPY package.json package-lock.json ./
COPY web/package.json web/
RUN npm ci && npx remotion browser ensure

COPY . .
# Next.js derlerken sunucu modüllerini yükler; bağlantı kurulmaz ama değişkenler tanımlı olmalı. Bu değerler yalnızca bu adımda geçerli,
# imaja yazılmaz; çalışırken .env'den gelir. Remotion paketleyicisi ve Next.js önbelleklerini çalışırken yazar; uygulama root olmadan çalışır.
RUN DATABASE_URL=postgres://derleme@127.0.0.1:1/derleme BETTER_AUTH_SECRET=yalnizca-derleme DEPOLAMA=yerel \
  npm run build -w @kliplan/web \
  && mkdir -p .cache cikti node_modules/.cache \
  && chown -R node:node .cache cikti web/.next node_modules/.cache

ENV NODE_ENV=production
USER node

# Servis compose.sunucu.yaml'da seçilir: web, worker veya tek seferlik komutlar (migration, yedek, temizlik).
CMD ["npm", "run", "start", "-w", "@kliplan/web"]
