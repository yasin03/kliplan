import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { ilanKlasorunuDogrula } from "../pipeline/dogrulama.js";
import { fotograflariHazirla } from "../pipeline/fotografHazirlama.js";
import { SenaryoHatasi } from "../pipeline/senaryoUretimi.js";
import { TelaffuzHatasi } from "../pipeline/telaffuz.js";
import { AdimHatasi } from "../pipeline/uretim.js";
import { VideoVerisiHatasi, videoPropsOlustur } from "../pipeline/videoProps.js";
import { KullaniciHatasi } from "../kimlik/kullanici.js";
import { SaglayiciHatasi } from "../providers/ScriptProvider.js";
import type { VideoProps } from "../remotion/tipler.js";
import { alanYolu, turkceHataHaritasi } from "../schema/hatalar.js";
import { sahneDosyasiSemasi } from "../schema/sahne.js";

export class KomutHatasi extends Error {}

export const ilanAdi = (klasor: string) => path.basename(path.resolve(klasor));
export const onbellekKlasoru = (klasor: string) => path.resolve(".cache", ilanAdi(klasor));

async function sahneleriOku(yol: string) {
  let veri: unknown;
  try {
    veri = JSON.parse(await readFile(yol, "utf8"));
  } catch {
    throw new KomutHatasi(`Sahne dosyası okunamadı veya geçerli JSON değil: ${yol}`);
  }
  const sonuc = sahneDosyasiSemasi.safeParse(veri, { error: turkceHataHaritasi });
  if (!sonuc.success) {
    const satirlar = sonuc.error.issues.map((s) => `  - ${alanYolu(s.path)}: ${s.message}`);
    throw new KomutHatasi(`Sahne dosyası geçersiz (${yol}):\n${satirlar.join("\n")}`);
  }
  return sonuc.data;
}

/** İlanı doğrular; uyarıları yazar, hata varsa durur. */
export async function ilaniYukle(klasor: string) {
  const { ilan, rapor } = await ilanKlasorunuDogrula(klasor);
  for (const u of rapor.uyarilar) console.warn(`⚠ ${u.alan}: ${u.mesaj}`);
  if (!ilan || !rapor.gecerli) {
    const satirlar = rapor.hatalar.map((h) => `  - ${h.alan}: ${h.mesaj}`);
    throw new KomutHatasi(`İlan doğrulanamadı:\n${satirlar.join("\n")}`);
  }
  return { ilan, rapor };
}

/** İlanı doğrular, fotoğrafları hazırlar ve elle yazılmış sahnelerden video verisini kurar. */
export async function ornekVideoVerisiHazirla(klasor: string, senaryoYolu?: string) {
  const { ilan } = await ilaniYukle(klasor);
  const sahneler = await sahneleriOku(senaryoYolu ?? path.join(klasor, "ornek-sahneler.json"));
  const publicKlasoru = path.join(onbellekKlasoru(klasor), "public");
  const hazirlik = await fotograflariHazirla(klasor, ilan, publicKlasoru);
  for (const [sira, s] of sahneler.entries()) {
    if (!s.ses) continue;
    try {
      await stat(path.join(publicKlasoru, s.ses.src));
    } catch {
      throw new KomutHatasi(`Sahne ${sira + 1}: ses dosyası bulunamadı (${s.ses.src}). Önce şunu çalıştırın: npm run ses -- ${klasor}`);
    }
  }
  const props: VideoProps = videoPropsOlustur(ilan, sahneler, hazirlik);
  return { ilan, props, publicKlasoru };
}

export async function calistir(is: () => Promise<void>) {
  try {
    await is();
  } catch (hata) {
    if (hata instanceof AdimHatasi) {
      console.error(`✗ Adım ${hata.adim} başarısız:\n  ${hata.message.replace(/\n/g, "\n  ")}`);
      console.error(`  Çözüm: ${hata.cozum}`);
    } else if (
      hata instanceof KomutHatasi ||
      hata instanceof VideoVerisiHatasi ||
      hata instanceof SenaryoHatasi ||
      hata instanceof SaglayiciHatasi ||
      hata instanceof TelaffuzHatasi ||
      hata instanceof KullaniciHatasi
    ) {
      console.error(`✗ ${hata.message}`);
    } else {
      console.error("✗ Beklenmeyen hata:", hata);
    }
    process.exitCode = 1;
  }
}
