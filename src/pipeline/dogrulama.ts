import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { alanYolu, turkceHataHaritasi } from "../schema/hatalar.js";
import { ilanSemasi, type Ilan } from "../schema/ilan.js";
import { KontrolRaporu } from "./kontrolRaporu.js";

export const ILAN_DOSYASI = "ilan.json";
export const FOTOGRAF_KLASORU = "fotograflar";
/** Yer tutucu görsel üreticisinin, ürettiği dosyaları listelediği işaret dosyası. */
export const ORNEK_ISARET_DOSYASI = "ORNEK-GORSELLER.json";

/** Uzun kenarı bundan kısa fotoğraflar 1080x1920 videoda belirgin şekilde büyütülür ve bulanıklaşır. */
export const ONERILEN_MIN_UZUN_KENAR = 1280;

export type DogrulamaSonucu = {
  klasor: string;
  /** Şema geçerliyse ilan; aksi halde `null`. Fotoğraf hataları olsa bile şema geçerliyse doludur. */
  ilan: Ilan | null;
  rapor: KontrolRaporu;
};

async function dosyaVarMi(yol: string): Promise<boolean> {
  try {
    return (await stat(yol)).isFile();
  } catch {
    return false;
  }
}

/** Saf şema doğrulaması: dosya sistemine bakmaz. */
export function ilanVerisiniDogrula(veri: unknown, rapor: KontrolRaporu): Ilan | null {
  const sonuc = ilanSemasi.safeParse(veri, { error: turkceHataHaritasi });
  if (!sonuc.success) {
    for (const sorun of sonuc.error.issues) rapor.hata(alanYolu(sorun.path), sorun.message);
    return null;
  }
  return sonuc.data;
}

/** Onaysız, eksik veya kendi içinde çelişkili bilgileri uyarı olarak rapora ekler. */
export function tutarlilikKontrolu(ilan: Ilan, rapor: KontrolRaporu): void {
  const onaysizlar: [string, boolean][] = [
    ["Yetki belge numarası", ilan.yetkiBelgeNo.onayli],
    ["Telefon", ilan.telefon.onayli],
    ["Fiyat", ilan.fiyatTl.onayli],
    ["Konum", ilan.konum.onayli],
  ];
  for (const [alan, onayli] of onaysizlar) {
    if (!onayli) rapor.uyari(alan, "Onaylı değil. Videoda kullanılmayacak, emlakçıyla doğrulayın.");
  }

  const kira = ilan.kiraDurumu;
  if (kira && !kira.onayli) {
    const tutar = kira.kiraTl === undefined ? "" : ` (${kira.kiraTl.toLocaleString("tr-TR")} TL)`;
    const not = kira.not ? ` Not: ${kira.not}` : "";
    rapor.uyari("Kira durumu", `"${kira.aciklama}"${tutar} onaylı değil, videoda kullanılmayacak.${not}`);
  }

  if (ilan.netM2 > ilan.brutM2) {
    rapor.uyari("Metrekare", `Net metrekare (${ilan.netM2}) brüt metrekareden (${ilan.brutM2}) büyük olamaz.`);
  }
  if (ilan.bulunduguKat > ilan.katSayisi) {
    rapor.uyari("Kat", `Bulunduğu kat (${ilan.bulunduguKat}) bina kat sayısından (${ilan.katSayisi}) büyük.`);
  }
}

export const icerikOzeti = (icerik: Buffer) => createHash("sha256").update(icerik).digest("hex");

/** İşaret dosyasını okur: dosya adı → üretildiği andaki SHA-256 özeti. */
export async function ornekIsaretleriniOku(fotografKlasoru: string): Promise<Record<string, string>> {
  try {
    const icerik = JSON.parse(await readFile(path.join(fotografKlasoru, ORNEK_ISARET_DOSYASI), "utf8")) as unknown;
    if (icerik && typeof icerik === "object" && !Array.isArray(icerik)) {
      return Object.fromEntries(Object.entries(icerik).filter((e): e is [string, string] => typeof e[1] === "string"));
    }
  } catch {
    // İşaret dosyası yoksa örnek görsel de yoktur.
  }
  return {};
}

async function fotograflariKontrolEt(klasor: string, ilan: Ilan, rapor: KontrolRaporu): Promise<void> {
  const fotografKlasoru = path.join(klasor, FOTOGRAF_KLASORU);
  const ornekler = await ornekIsaretleriniOku(fotografKlasoru);
  const gorulen = new Set<string>();

  for (const [sira, foto] of ilan.fotograflar.entries()) {
    const alan = `Fotoğraflar → ${sira + 1}. öğe`;
    if (gorulen.has(foto.dosya)) rapor.uyari(alan, `"${foto.dosya}" listede birden fazla kez geçiyor.`);
    gorulen.add(foto.dosya);

    const dosyaYolu = path.join(fotografKlasoru, foto.dosya);
    if (!(await dosyaVarMi(dosyaYolu))) {
      rapor.hata(alan, `Fotoğraf dosyası bulunamadı: ${FOTOGRAF_KLASORU}/${foto.dosya}`);
      continue;
    }

    const icerik = await readFile(dosyaYolu);
    let genislik: number;
    let yukseklik: number;
    try {
      ({ width: genislik, height: yukseklik } = await sharp(icerik).metadata());
    } catch {
      rapor.hata(alan, `"${foto.dosya}" açılamadı. Dosya bozuk olabilir veya gerçekte bir görsel değil.`);
      continue;
    }

    if (ornekler[foto.dosya] === icerikOzeti(icerik)) {
      rapor.uyari(alan, `"${foto.dosya}" gerçek fotoğraf değil, ÖRNEK yer tutucu görsel. Müşteriye gönderilmemeli.`);
    } else if (Math.max(genislik, yukseklik) < ONERILEN_MIN_UZUN_KENAR) {
      rapor.uyari(
        alan,
        `"${foto.dosya}" düşük çözünürlüklü (${genislik}x${yukseklik}). Videoda bulanık görünebilir; ` +
          `uzun kenarı en az ${ONERILEN_MIN_UZUN_KENAR} piksel olan bir sürüm önerilir.`,
      );
    }
  }

  if (ilan.logo && !(await dosyaVarMi(path.join(klasor, ilan.logo)))) {
    rapor.hata("Logo", `Logo dosyası bulunamadı: ${ilan.logo}`);
  }
}

/** İlan klasörünü okur; şema, fotoğraf ve tutarlılık kontrollerinin sonucunu döner. Hata fırlatmaz. */
export async function ilanKlasorunuDogrula(klasor: string): Promise<DogrulamaSonucu> {
  const rapor = new KontrolRaporu();
  const ilanYolu = path.join(klasor, ILAN_DOSYASI);

  let ham: string;
  try {
    ham = await readFile(ilanYolu, "utf8");
  } catch {
    rapor.hata("ilan.json", `Dosya bulunamadı veya okunamadı: ${ilanYolu}`);
    return { klasor, ilan: null, rapor };
  }

  let veri: unknown;
  try {
    veri = JSON.parse(ham);
  } catch (hata) {
    const ayrinti = hata instanceof Error ? hata.message : String(hata);
    rapor.hata("ilan.json", `Geçerli bir JSON değil (virgül, tırnak veya parantez hatası olabilir). Ayrıntı: ${ayrinti}`);
    return { klasor, ilan: null, rapor };
  }

  const ilan = ilanVerisiniDogrula(veri, rapor);
  if (ilan) {
    tutarlilikKontrolu(ilan, rapor);
    await fotograflariKontrolEt(klasor, ilan, rapor);
  }
  return { klasor, ilan, rapor };
}
