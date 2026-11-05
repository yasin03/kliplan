import path from "node:path";
import { config } from "dotenv";
import type { NextConfig } from "next";

// Ortam değişkenleri depo kökündeki tek .env dosyasından okunur.
config({ path: path.resolve(import.meta.dirname, "../.env"), quiet: true });
// Sunucu kodunun proje kökünü bilmesi için (ör. yerel dosya deposu); paketlenmiş kodda import.meta.dirname yok.
process.env.KLIPLAN_KOK ??= path.resolve(import.meta.dirname, "..");

/**
 * Çekirdek kod (../src) NodeNext gereği `.js` uzantılı import ediyor. Turbopack bunu `.ts` dosyasına
 * çözmediği için webpack kullanılıyor (`next dev --webpack`); Remotion'daki ayarın aynısı.
 */
const nextConfig: NextConfig = {
  experimental: { externalDir: true },
  // Kuyruk istemcisi Node'un ağ modüllerini kullanıyor; paketlenmeden doğrudan yüklenir.
  serverExternalPackages: ["bullmq", "ioredis"],
  webpack: (config: { resolve: { extensionAlias?: Record<string, string[]> } }) => {
    config.resolve.extensionAlias = { ".js": [".ts", ".tsx", ".js"] };
    return config;
  },
};

export default nextConfig;
