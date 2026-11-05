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
  /**
   * Oturum gerektirmeden, süre sonuna kadar dosyayı açan bağlantı.
   * `indirmeAdi` verilirse tarayıcı dosyayı bu adla indirir (Content-Disposition: attachment).
   */
  imzaliBaglanti(anahtar: string, sureSn: number, indirmeAdi?: string): Promise<string>;
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

/** İndirme adı başlığa yazılır; başlık enjeksiyonunu önlemek için yalnızca güvenli karakterler. */
export const GECERLI_INDIRME_ADI = /^[A-Za-z0-9._-]{1,100}$/;

/** Yerel depolamanın imzalı bağlantıları için HMAC; R2 kendi imzasını kullanır. İndirme adı da imzaya girer. */
export function imzala(anahtar: string, sonZaman: number, gizli: string, indirmeAdi = ""): string {
  return createHmac("sha256", gizli)
    .update(`${anahtar}\n${sonZaman}${indirmeAdi ? `\n${indirmeAdi}` : ""}`)
    .digest("base64url");
}

export function imzaGecerliMi(anahtar: string, sonZaman: number, imza: string, gizli: string, simdi = Date.now(), indirmeAdi = ""): boolean {
  if (!Number.isFinite(sonZaman) || sonZaman < simdi) return false;
  const beklenen = Buffer.from(imzala(anahtar, sonZaman, gizli, indirmeAdi));
  const gelen = Buffer.from(imza);
  return beklenen.length === gelen.length && timingSafeEqual(beklenen, gelen);
}

/**
 * `Range: bytes=...` başlığını çözer. Safari videoyu yalnızca parça parça isteyerek oynatır.
 * Tek aralık desteklenir; geçersiz aralık `"gecersiz"` (416), başlık yoksa `null` (tam dosya) döner.
 */
export function aralikCoz(baslik: string | null, boyut: number): { bas: number; son: number } | "gecersiz" | null {
  if (!baslik) return null;
  const e = /^bytes=(\d*)-(\d*)$/.exec(baslik.trim());
  if (!e || (e[1] === "" && e[2] === "")) return "gecersiz";
  let bas: number;
  let son: number;
  if (e[1] === "") {
    // "bytes=-500": son 500 bayt.
    bas = Math.max(0, boyut - Number(e[2]));
    son = boyut - 1;
  } else {
    bas = Number(e[1]);
    son = e[2] === "" ? boyut - 1 : Math.min(Number(e[2]), boyut - 1);
  }
  if (bas > son || bas >= boyut) return "gecersiz";
  return { bas, son };
}
