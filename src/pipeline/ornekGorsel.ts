import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import type { Fotograf, FotografTuru } from "../schema/ilan.js";
import { FOTOGRAF_KLASORU, ORNEK_ISARET_DOSYASI, icerikOzeti, ornekIsaretleriniOku } from "./dogrulama.js";

const TUR_ETIKETLERI: Record<FotografTuru, string> = {
  bina: "Bina",
  salon: "Salon",
  mutfak: "Mutfak",
  yatak_odasi: "Yatak odası",
  banyo: "Banyo",
  koridor: "Koridor",
  balkon: "Balkon",
  cocuk_odasi: "Çocuk odası",
  dis_mekan: "Dış mekân",
  manzara: "Manzara",
  diger: "Diğer",
};

const xmlKacis = (metin: string) =>
  metin.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Bina fotoğrafları dikey, diğerleri yatay üretilir. Böylece Faz 2'deki bulanık dolgu
 * her iki yönle de test edilebilir.
 */
function boyut(tur: FotografTuru): { genislik: number; yukseklik: number } {
  return tur === "bina" ? { genislik: 1080, yukseklik: 1440 } : { genislik: 1600, yukseklik: 1200 };
}

/** Üzerinde büyük "ÖRNEK" yazan, gerçek fotoğrafla karıştırılamayacak bir görsel üretir. */
export async function ornekGorselOlustur(foto: Fotograf, sira: number): Promise<Buffer> {
  const { genislik, yukseklik } = boyut(foto.tur);
  const ton = (sira * 47) % 360;
  const orta = genislik / 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${genislik}" height="${yukseklik}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${ton},35%,38%)"/>
      <stop offset="1" stop-color="hsl(${(ton + 40) % 360},35%,22%)"/>
    </linearGradient>
    <pattern id="c" width="80" height="80" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="40" height="80" fill="#ffffff" opacity="0.05"/>
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <rect width="100%" height="100%" fill="url(#c)"/>
  <rect x="24" y="24" width="${genislik - 48}" height="${yukseklik - 48}" fill="none" stroke="#ffffff" stroke-width="6" stroke-dasharray="28 18" opacity="0.6"/>
  <g font-family="Helvetica, Arial, sans-serif" fill="#ffffff" text-anchor="middle">
    <text x="${orta}" y="${yukseklik / 2 - 40}" font-size="${Math.round(genislik / 5)}" font-weight="700">ÖRNEK</text>
    <text x="${orta}" y="${yukseklik / 2 + 60}" font-size="56" font-weight="600">${xmlKacis(TUR_ETIKETLERI[foto.tur])}</text>
    <text x="${orta}" y="${yukseklik / 2 + 130}" font-size="36" opacity="0.85">Gerçek fotoğraf değildir · çğıİöşü</text>
    <text x="${orta}" y="${yukseklik - 70}" font-size="30" opacity="0.7">${xmlKacis(foto.dosya)}</text>
  </g>
</svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 85 }).toBuffer();
}

async function varMi(yol: string): Promise<boolean> {
  try {
    await stat(yol);
    return true;
  } catch {
    return false;
  }
}

/**
 * Listede olup klasörde bulunmayan fotoğraflar için yer tutucu üretir. Var olan dosyalara
 * dokunmaz. Üretilenlerin özetini işaret dosyasına yazar; doğrulama, içeriği değişmemiş
 * dosyaları ÖRNEK uyarısıyla raporlar.
 */
export async function eksikFotograflariUret(klasor: string, fotograflar: Fotograf[]): Promise<string[]> {
  const fotografKlasoru = path.join(klasor, FOTOGRAF_KLASORU);
  await mkdir(fotografKlasoru, { recursive: true });

  const isaretler = await ornekIsaretleriniOku(fotografKlasoru);
  const uretilenler: string[] = [];
  for (const [sira, foto] of fotograflar.entries()) {
    const hedef = path.join(fotografKlasoru, foto.dosya);
    if (await varMi(hedef)) continue;
    const gorsel = await ornekGorselOlustur(foto, sira);
    await writeFile(hedef, gorsel);
    isaretler[foto.dosya] = icerikOzeti(gorsel);
    uretilenler.push(foto.dosya);
  }

  if (uretilenler.length > 0) {
    await writeFile(path.join(fotografKlasoru, ORNEK_ISARET_DOSYASI), JSON.stringify(isaretler, null, 2) + "\n");
  }
  return uretilenler;
}
