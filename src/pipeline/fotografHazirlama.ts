import { copyFile, cp, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import type { HazirFotograf } from "../remotion/tipler.js";
import type { Ilan } from "../schema/ilan.js";
import { FOTOGRAF_KLASORU } from "./dogrulama.js";

/** Videoda yakınlaşma payı kalsın diye 1080 pikselin iki katına kadar korunur. */
const EN_BUYUK_KENAR = 2160;
const PROJE_KOKU = path.resolve(import.meta.dirname, "../..");

async function gunceldir(kaynak: string, hedef: string): Promise<boolean> {
  try {
    const [k, h] = await Promise.all([stat(kaynak), stat(hedef)]);
    return h.mtimeMs >= k.mtimeMs;
  } catch {
    return false;
  }
}

export type HazirlikSonucu = {
  publicKlasoru: string;
  fotograflar: Record<string, HazirFotograf>;
  logo: string | null;
};

/**
 * Remotion'ın okuyacağı `public` klasörünü kurar: fontlar, döndürülmüş (EXIF) ve küçültülmüş
 * JPEG fotoğraflar ve varsa logo. Kaynağı değişmeyen fotoğraf tekrar işlenmez.
 */
export async function fotograflariHazirla(ilanKlasoru: string, ilan: Ilan, publicKlasoru: string): Promise<HazirlikSonucu> {
  const ilanHedefi = path.join(publicKlasoru, "ilan");
  await mkdir(ilanHedefi, { recursive: true });
  await cp(path.join(PROJE_KOKU, "public", "fontlar"), path.join(publicKlasoru, "fontlar"), { recursive: true });

  const fotograflar: Record<string, HazirFotograf> = {};
  for (const { dosya } of ilan.fotograflar) {
    if (fotograflar[dosya]) continue;
    const kaynak = path.join(ilanKlasoru, FOTOGRAF_KLASORU, dosya);
    const hedefAdi = `${path.parse(dosya).name}.jpg`;
    const hedef = path.join(ilanHedefi, hedefAdi);

    if (!(await gunceldir(kaynak, hedef))) {
      await sharp(kaynak)
        .rotate()
        .resize({ width: EN_BUYUK_KENAR, height: EN_BUYUK_KENAR, fit: "inside", withoutEnlargement: true })
        .flatten({ background: "#000000" })
        .jpeg({ quality: 90 })
        .toFile(hedef);
    }
    const { width, height } = await sharp(hedef).metadata();
    fotograflar[dosya] = { src: `ilan/${hedefAdi}`, genislik: width, yukseklik: height };
  }

  let logo: string | null = null;
  if (ilan.logo) {
    const hedefAdi = `logo${path.extname(ilan.logo).toLowerCase()}`;
    await copyFile(path.join(ilanKlasoru, ilan.logo), path.join(ilanHedefi, hedefAdi));
    logo = `ilan/${hedefAdi}`;
  }

  return { publicKlasoru, fotograflar, logo };
}
