import { randomUUID } from "node:crypto";
import { BufferSource, Input, MP3, MP4, WAVE } from "mediabunny";
import sharp from "sharp";

/** Logo ve müzik yüklemesinde kullanıcıya olduğu gibi gösterilen hata. */
export class GorunumDosyasiHatasi extends Error {}

export const LOGO_EN_BUYUK_MB = 5;
export const MUZIK_EN_BUYUK_MB = 15;
const LOGO_KABUL = new Set(["png", "jpeg", "webp"]);
/** Videoda logo en fazla ~190x380 piksel; iki katı yakınlaşma ve keskinlik için yeter. */
const LOGO_EN_BUYUK = { genislik: 1200, yukseklik: 600 };
const MUZIK_EN_KISA_SN = 5;
const MUZIK_EN_UZUN_SN = 10 * 60;

export type IslenmisLogo = { dosyaAdi: string; icerik: Buffer; icerikTuru: "image/png"; genislik: number; yukseklik: number; uyarilar: string[] };

/** Saydam olmayan piksellerin ortalama parlaklığı (0-1). Saydam kısmı olmayan logoda `null`: kendi zemini var, her temada görünür. */
async function logoParlakligi(icerik: Buffer): Promise<number | null> {
  const { data, info } = await sharp(icerik).resize(200, 200, { fit: "inside" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let toplam = 0;
  let sayi = 0;
  let saydam = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    if (data[i + 3]! < 128) {
      saydam++;
      continue;
    }
    toplam += (0.2126 * data[i]! + 0.7152 * data[i + 1]! + 0.0722 * data[i + 2]!) / 255;
    sayi++;
  }
  if (saydam === 0 || sayi === 0) return null;
  return toplam / sayi;
}

/**
 * Logoyu içeriğinden doğrular, küçültür ve saydamlığı koruyarak PNG'ye çevirir. Çıktıda EXIF ve diğer üst veriler yok.
 * SVG kabul edilmez (içinde betik ve dış bağlantı olabilir). Saydam zeminli logo çok açık veya çok koyuysa uyarı döner.
 */
export async function logoyuIsle(icerik: Buffer): Promise<IslenmisLogo> {
  if (icerik.length > LOGO_EN_BUYUK_MB * 1024 * 1024) throw new GorunumDosyasiHatasi(`Logo ${LOGO_EN_BUYUK_MB} MB'tan büyük olamaz.`);
  let bicim: string | undefined;
  try {
    ({ format: bicim } = await sharp(icerik).metadata());
  } catch {
    throw new GorunumDosyasiHatasi("Dosya açılamadı. Bozuk olabilir veya bir görsel değil.");
  }
  if (bicim === "svg") throw new GorunumDosyasiHatasi("SVG logo desteklenmiyor. Logonuzu PNG olarak (tercihen saydam zeminli) kaydedip yükleyin.");
  if (!bicim || !LOGO_KABUL.has(bicim)) throw new GorunumDosyasiHatasi("Logo PNG, JPEG veya WebP olmalı.");

  const { data, info } = await sharp(icerik)
    .rotate()
    .resize({ width: LOGO_EN_BUYUK.genislik, height: LOGO_EN_BUYUK.yukseklik, fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer({ resolveWithObject: true });

  const uyarilar: string[] = [];
  if (Math.max(info.width, info.height) < 200) uyarilar.push(`Logo küçük (${info.width}×${info.height}); videoda bulanık görünebilir.`);
  const parlaklik = await logoParlakligi(data);
  if (parlaklik !== null && parlaklik > 0.85) uyarilar.push("Logo çok açık renkli; açık temada zor görünür. Açık temada koyu renkli bir logo önerilir.");
  if (parlaklik !== null && parlaklik < 0.12) uyarilar.push("Logo çok koyu renkli; koyu ve sade temalarda zor görünür. Bu temalarda açık renkli bir logo önerilir.");

  return { dosyaAdi: `${randomUUID().slice(0, 8)}.png`, icerik: data, icerikTuru: "image/png", genislik: info.width, yukseklik: info.height, uyarilar };
}

export type IslenmisMuzik = { dosyaAdi: string; icerik: Buffer; icerikTuru: string; sureSn: number };

/**
 * Müzik dosyasını içeriğinden doğrular (uzantıya güvenmez): MP3, M4A (AAC) veya WAV, görüntüsüz, 5 sn - 10 dk.
 * Dosya olduğu gibi saklanır; adı rastgele üretilir, kullanıcının dosya adı kullanılmaz.
 */
export async function muzigiIsle(icerik: Buffer): Promise<IslenmisMuzik> {
  if (icerik.length > MUZIK_EN_BUYUK_MB * 1024 * 1024) throw new GorunumDosyasiHatasi(`Müzik dosyası ${MUZIK_EN_BUYUK_MB} MB'tan büyük olamaz.`);
  const girdi = new Input({ source: new BufferSource(icerik), formats: [MP3, MP4, WAVE] });
  try {
    let bicim;
    let sureSn: number;
    let goruntuVar: boolean;
    let sesVar: boolean;
    try {
      bicim = await girdi.getFormat();
      [sesVar, goruntuVar, sureSn] = await Promise.all([
        girdi.getPrimaryAudioTrack().then(Boolean),
        girdi.getPrimaryVideoTrack().then(Boolean),
        girdi.computeDuration(),
      ]);
    } catch {
      throw new GorunumDosyasiHatasi("Dosya okunamadı. Müzik MP3, M4A veya WAV biçiminde olmalı.");
    }
    if (goruntuVar) throw new GorunumDosyasiHatasi("Video dosyası yüklenemez; yalnızca müzik (MP3, M4A veya WAV).");
    if (!sesVar) throw new GorunumDosyasiHatasi("Dosyada ses bulunamadı.");
    if (!(sureSn >= MUZIK_EN_KISA_SN)) throw new GorunumDosyasiHatasi(`Müzik en az ${MUZIK_EN_KISA_SN} saniye olmalı.`);
    if (sureSn > MUZIK_EN_UZUN_SN) throw new GorunumDosyasiHatasi("Müzik en fazla 10 dakika olabilir.");

    const [uzanti, icerikTuru] = bicim === MP3 ? ["mp3", "audio/mpeg"] : bicim === WAVE ? ["wav", "audio/wav"] : ["m4a", "audio/mp4"];
    return { dosyaAdi: `${randomUUID().slice(0, 8)}.${uzanti}`, icerik, icerikTuru, sureSn };
  } finally {
    girdi.dispose();
  }
}
