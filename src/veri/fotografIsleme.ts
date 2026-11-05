import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { ONERILEN_MIN_UZUN_KENAR } from "../pipeline/dogrulama.js";

export class FotografHatasi extends Error {}

export const EN_BUYUK_DOSYA_MB = 20;
export const EN_FAZLA_FOTOGRAF = 20;
/** Pipeline da fotoğrafları bu boyuta küçültüyor (`fotografHazirlama.ts`); daha büyüğünü saklamak yer israfı. */
const EN_BUYUK_KENAR = 2160;
const KABUL_EDILEN_BICIMLER = new Set(["jpeg", "png", "webp"]);

export type IslenmisFotograf = {
  dosyaAdi: string;
  icerik: Buffer;
  icerikTuru: "image/jpeg";
  genislik: number;
  yukseklik: number;
};

/** Panelde fotoğrafın altında gösterilir; yüklemeyi engellemez. */
export function cozunurlukUyarisi(genislik: number, yukseklik: number): string | null {
  if (Math.max(genislik, yukseklik) >= ONERILEN_MIN_UZUN_KENAR) return null;
  return `Düşük çözünürlük (${genislik}×${yukseklik}). Videoda bulanık görünebilir; daha büyük bir sürüm önerilir.`;
}

/**
 * Yüklenen dosyayı içeriğinden doğrular (uzantıya güvenmez), EXIF yönüne göre döndürür, küçültür ve JPEG'e çevirir.
 * Çıktıda EXIF yok: telefon fotoğraflarındaki GPS konumu ve cihaz bilgisi saklanmaz.
 * Dosya adı rastgele üretilir; kullanıcının dosya adı (kişisel bilgi içerebilir) kullanılmaz.
 */
export async function fotografiIsle(icerik: Buffer): Promise<IslenmisFotograf> {
  if (icerik.length > EN_BUYUK_DOSYA_MB * 1024 * 1024) {
    throw new FotografHatasi(`Dosya ${EN_BUYUK_DOSYA_MB} MB'tan büyük. Daha küçük bir sürümünü yükleyin.`);
  }

  let bicim: string | undefined;
  try {
    ({ format: bicim } = await sharp(icerik).metadata());
  } catch {
    throw new FotografHatasi("Dosya açılamadı. Bozuk olabilir veya bir fotoğraf değil.");
  }
  if (bicim === "heif") {
    throw new FotografHatasi("HEIC biçimi desteklenmiyor. Telefonunuzun kamera ayarından 'En uyumlu' (JPEG) seçin veya fotoğrafı JPEG olarak paylaşın.");
  }
  if (!bicim || !KABUL_EDILEN_BICIMLER.has(bicim)) {
    throw new FotografHatasi("Yalnızca JPEG, PNG ve WebP fotoğraflar yüklenebilir.");
  }

  const { data, info } = await sharp(icerik)
    .rotate()
    .resize({ width: EN_BUYUK_KENAR, height: EN_BUYUK_KENAR, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#000000" })
    .jpeg({ quality: 90 })
    .toBuffer({ resolveWithObject: true });

  return {
    dosyaAdi: `${randomUUID().slice(0, 8)}.jpg`,
    icerik: data,
    icerikTuru: "image/jpeg",
    genislik: info.width,
    yukseklik: info.height,
  };
}
