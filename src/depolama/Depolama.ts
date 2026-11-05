import { createHmac, timingSafeEqual } from "node:crypto";

export class DepolamaHatasi extends Error {}

/**
 * Dosya deposu. Geliştirmede yerel klasör, sunucuda S3 uyumlu servis (Cloudflare R2).
 * Anahtarlar `ofis/<ofisId>/...` biçimindedir; erişim kontrolü bu önek üzerinden yapılır.
 */
export interface Depolama {
  readonly kimlik: string;
  yaz(anahtar: string, icerik: Buffer, icerikTuru: string): Promise<void>;
  oku(anahtar: string): Promise<Buffer>;
  /** Dosya yoksa hata vermez. */
  sil(anahtar: string): Promise<void>;
  /** Önekle başlayan tüm dosyaları siler, ör. bir ilanın bütün dosyaları. */
  onekSil(onek: string): Promise<void>;
  /** Oturum gerektirmeden, süre sonuna kadar dosyayı açan bağlantı. */
  imzaliBaglanti(anahtar: string, sureSn: number): Promise<string>;
}

const GECERLI_ANAHTAR = /^ofis\/[A-Za-z0-9-]+\/(?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+$/;

/** Klasör dışına çıkmayı (`..`) ve beklenmeyen karakterleri engeller. */
export function anahtariDogrula(anahtar: string): string {
  if (!GECERLI_ANAHTAR.test(anahtar) || anahtar.split("/").some((p) => p === "." || p === "..")) {
    throw new DepolamaHatasi(`Geçersiz dosya anahtarı: ${anahtar}`);
  }
  return anahtar;
}

export const ofisOneki = (ofisId: string) => `ofis/${ofisId}/`;
export const ilanOneki = (ofisId: string, ilanId: string) => `${ofisOneki(ofisId)}ilan/${ilanId}/`;

/** Yerel depolamanın imzalı bağlantıları için HMAC; R2 kendi imzasını kullanır. */
export function imzala(anahtar: string, sonZaman: number, gizli: string): string {
  return createHmac("sha256", gizli).update(`${anahtar}\n${sonZaman}`).digest("base64url");
}

export function imzaGecerliMi(anahtar: string, sonZaman: number, imza: string, gizli: string, simdi = Date.now()): boolean {
  if (!Number.isFinite(sonZaman) || sonZaman < simdi) return false;
  const beklenen = Buffer.from(imzala(anahtar, sonZaman, gizli));
  const gelen = Buffer.from(imza);
  return beklenen.length === gelen.length && timingSafeEqual(beklenen, gelen);
}
