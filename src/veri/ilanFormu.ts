import type { z } from "zod";
import { vurguHatasi } from "../pipeline/renk.js";
import { VARSAYILAN_TEMA } from "../remotion/temalar.js";
import { alanYolu, turkceHataHaritasi } from "../schema/hatalar.js";
import { FOTOGRAF_TURLERI, type FotografTuru, type Ilan, ilanSemasi } from "../schema/ilan.js";

/**
 * Web formu ile `ilan.json` arasındaki dönüşüm. Form düz alan adları kullanır (`fiyatTl.deger`, `konum.il`);
 * doğrulama CLI ile aynı Zod şemasıyla yapılır, hatalar alan adına göre döner.
 */

/**
 * Formda girilen bilgiler. Fotoğraflar ayrı tabloda; ofis adı ofis kaydından gelir.
 * Logo, vurgu rengi, tema ve müzik ofis ayarlarından ve ilanın görünüm seçiminden (`gorunum.ts`), telaffuz sözlüğü şimdilik yalnızca CLI'da.
 */
export const ilanBilgiSemasi = ilanSemasi.omit({
  fotograflar: true,
  emlakOfisi: true,
  tema: true,
  logo: true,
  vurguRengi: true,
  muzik: true,
  kapanisResmi: true,
  sirketBilgileri: true,
  telaffuz: true,
});
export type IlanBilgileri = z.infer<typeof ilanBilgiSemasi>;

export const FOTOGRAF_TURU_ADLARI: Record<FotografTuru, string> = {
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

export const fotografTuruMu = (tur: string): tur is FotografTuru => (FOTOGRAF_TURLERI as readonly string[]).includes(tur);

/** Kira durumu seçenekleri; seçilen metin `kiraDurumu.aciklama` olarak saklanır. */
export const KULLANIM_DURUMLARI = ["Boş", "Kiracılı", "Mülk sahibi oturuyor"] as const;

/** Formun gönderdiği değerler: metin kutuları metin, işaretli kutular "on", işaretsizler hiç gelmez. */
export type FormAlanlari = Record<string, string | undefined>;
export type AlanHatalari = Record<string, string>;
export type FormSonucu = { basarili: true; veri: IlanBilgileri } | { basarili: false; hatalar: AlanHatalari };

const metin = (deger: string | undefined) => {
  const temiz = deger?.trim();
  return temiz ? temiz : undefined;
};

/** "4.500.000", "4 500 000 TL" → 4500000. Sayıya çevrilemezse metni olduğu gibi döner, şema "sayı olmalı" der. */
function tamSayi(deger: string | undefined): number | string | undefined {
  const temiz = metin(deger)
    ?.replace(/\s*(tl|₺)$/i, "")
    .replace(/[.\s]/g, "");
  if (temiz === undefined) return undefined;
  return /^-?\d+$/.test(temiz) ? Number(temiz) : temiz;
}

/** "65", "65,5" → sayı. Metrekarede ondalık virgülle yazılabilir. */
function ondalik(deger: string | undefined): number | string | undefined {
  const temiz = metin(deger)?.replace(/\s*(m²|m2)$/i, "").replace(",", ".");
  if (temiz === undefined) return undefined;
  return /^-?\d+(\.\d+)?$/.test(temiz) ? Number(temiz) : temiz;
}

/** "05057094488", "505 709 44 88", "+90 505..." → "0505 709 44 88". */
export function telefonuBicimlendir(deger: string | undefined): string | undefined {
  const ham = metin(deger);
  if (ham === undefined) return undefined;
  let rakamlar = ham.replace(/\D/g, "");
  if (rakamlar.startsWith("90") && rakamlar.length === 12) rakamlar = rakamlar.slice(2);
  if (rakamlar.length === 10 && !rakamlar.startsWith("0")) rakamlar = `0${rakamlar}`;
  if (rakamlar.length !== 11) return ham;
  return `${rakamlar.slice(0, 4)} ${rakamlar.slice(4, 7)} ${rakamlar.slice(7, 9)} ${rakamlar.slice(9)}`;
}

const evetHayir = (deger: string | undefined) => (deger === "evet" ? true : deger === "hayir" ? false : undefined);
const isaretli = (deger: string | undefined) => deger === "on" || deger === "true";

/** Özellikler satır satır veya virgülle yazılabilir; tekrarlar atılır. */
function ozellikListesi(deger: string | undefined): string[] {
  const parcalar = (deger ?? "")
    .split(/[\n,]/)
    .map((p) => p.trim())
    .filter(Boolean);
  return [...new Set(parcalar)];
}

/** Undefined alanları atar; şemadaki isteğe bağlı alanlar hiç yazılmamış gibi davranır. */
function tanimlilar<T extends Record<string, unknown>>(nesne: T): Partial<T> {
  return Object.fromEntries(Object.entries(nesne).filter(([, d]) => d !== undefined)) as Partial<T>;
}

function kiraDurumu(alanlar: FormAlanlari) {
  const aciklama = metin(alanlar["kiraDurumu.aciklama"]);
  const kira = tamSayi(alanlar["kiraDurumu.kiraTl"]);
  if (aciklama === undefined && kira === undefined) return undefined;
  return tanimlilar({
    aciklama,
    kiraTl: kira,
    onayli: isaretli(alanlar["kiraDurumu.onayli"]),
    not: metin(alanlar["kiraDurumu.not"]),
  });
}

/** Düz form alanlarını `ilan.json` yapısına çevirir. Doğrulama yapmaz. */
export function formuVeriyeCevir(alanlar: FormAlanlari): Record<string, unknown> {
  return tanimlilar({
    ilanNo: metin(alanlar.ilanNo)?.replace(/\s/g, ""),
    yetkiBelgeNo: { deger: metin(alanlar["yetkiBelgeNo.deger"])?.replace(/\s/g, ""), onayli: isaretli(alanlar["yetkiBelgeNo.onayli"]) },
    telefon: { deger: telefonuBicimlendir(alanlar["telefon.deger"]), onayli: isaretli(alanlar["telefon.onayli"]) },
    fiyatTl: { deger: tamSayi(alanlar["fiyatTl.deger"]), onayli: isaretli(alanlar["fiyatTl.onayli"]) },
    konum: {
      il: metin(alanlar["konum.il"]),
      ilce: metin(alanlar["konum.ilce"]),
      mahalle: metin(alanlar["konum.mahalle"]),
      onayli: isaretli(alanlar["konum.onayli"]),
    },
    odaSayisi: metin(alanlar.odaSayisi)?.replace(/\s/g, ""),
    brutM2: ondalik(alanlar.brutM2),
    netM2: ondalik(alanlar.netM2),
    binaYasi: tamSayi(alanlar.binaYasi),
    bulunduguKat: tamSayi(alanlar.bulunduguKat),
    katSayisi: tamSayi(alanlar.katSayisi),
    isitma: metin(alanlar.isitma),
    mutfak: metin(alanlar.mutfak),
    esyali: evetHayir(alanlar.esyali),
    krediyeUygun: evetHayir(alanlar.krediyeUygun),
    tapu: metin(alanlar.tapu),
    ozellikler: ozellikListesi(alanlar.ozellikler),
    kiraDurumu: kiraDurumu(alanlar),
  });
}

/** Zod yolunu formdaki alan adına çevirir: `["konum", "il"]` → `konum.il`. */
const alanAdi = (yol: readonly PropertyKey[]) => yol.map(String).join(".");

/** Formu çevirir ve doğrular. Her alan için ilk hata döner. */
export function ilanFormunuDogrula(alanlar: FormAlanlari): FormSonucu {
  const sonuc = ilanBilgiSemasi.safeParse(formuVeriyeCevir(alanlar), { error: turkceHataHaritasi });
  if (sonuc.success) return { basarili: true, veri: sonuc.data };
  const hatalar: AlanHatalari = {};
  for (const sorun of sonuc.error.issues) {
    const ad = alanAdi(sorun.path);
    hatalar[ad] ??= sorun.message;
  }
  return { basarili: false, hatalar };
}

const evetHayirMetni = (deger: unknown) => (deger === true ? "evet" : deger === false ? "hayir" : "");
const yaz = (deger: unknown) => (deger === undefined || deger === null ? "" : String(deger));

/** Kayıtlı veriyi düzenleme formunun başlangıç değerlerine çevirir (`formuVeriyeCevir`'in tersi). */
export function veriyiFormaCevir(veri: Partial<IlanBilgileri>): FormAlanlari {
  return {
    ilanNo: yaz(veri.ilanNo),
    "yetkiBelgeNo.deger": yaz(veri.yetkiBelgeNo?.deger),
    "yetkiBelgeNo.onayli": veri.yetkiBelgeNo?.onayli ? "on" : "",
    "telefon.deger": yaz(veri.telefon?.deger),
    "telefon.onayli": veri.telefon?.onayli ? "on" : "",
    "fiyatTl.deger": typeof veri.fiyatTl?.deger === "number" ? veri.fiyatTl.deger.toLocaleString("tr-TR") : "",
    "fiyatTl.onayli": veri.fiyatTl?.onayli ? "on" : "",
    "konum.il": yaz(veri.konum?.il),
    "konum.ilce": yaz(veri.konum?.ilce),
    "konum.mahalle": yaz(veri.konum?.mahalle),
    "konum.onayli": veri.konum?.onayli ? "on" : "",
    odaSayisi: yaz(veri.odaSayisi),
    brutM2: yaz(veri.brutM2).replace(".", ","),
    netM2: yaz(veri.netM2).replace(".", ","),
    binaYasi: yaz(veri.binaYasi),
    bulunduguKat: yaz(veri.bulunduguKat),
    katSayisi: yaz(veri.katSayisi),
    isitma: yaz(veri.isitma),
    mutfak: yaz(veri.mutfak),
    esyali: evetHayirMetni(veri.esyali),
    krediyeUygun: evetHayirMetni(veri.krediyeUygun),
    tapu: yaz(veri.tapu),
    ozellikler: (veri.ozellikler ?? []).join("\n"),
    "kiraDurumu.aciklama": yaz(veri.kiraDurumu?.aciklama),
    "kiraDurumu.kiraTl": yaz(veri.kiraDurumu?.kiraTl),
    "kiraDurumu.onayli": veri.kiraDurumu?.onayli ? "on" : "",
    "kiraDurumu.not": yaz(veri.kiraDurumu?.not),
  };
}

export type IlanJsonuSonucu = { basarili: true; ilan: Ilan } | { basarili: false; hatalar: string[] };

/**
 * Veritabanındaki ilan, ofis ve fotoğraf kayıtlarından pipeline'ın okuduğu `ilan.json`'u kurar.
 * Worker (6.5) bu dosyayı geçici klasöre yazar; panel eksikleri göstermek için kullanır.
 * `gorunum`: tema, vurgu rengi, logo ve müzik (`gorunumAlanlari`).
 */
export function ilanJsonuOlustur(
  veri: Record<string, unknown>,
  ofis: { ad: string },
  fotograflar: readonly { dosyaAdi: string; tur: string }[],
  gorunum: Partial<Pick<Ilan, "tema" | "vurguRengi" | "logo" | "muzik" | "kapanisResmi" | "sirketBilgileri">> = {},
): IlanJsonuSonucu {
  const sonuc = ilanSemasi.safeParse(
    { ...veri, ...gorunum, emlakOfisi: ofis.ad, fotograflar: fotograflar.map((f) => ({ dosya: f.dosyaAdi, tur: f.tur })) },
    { error: turkceHataHaritasi },
  );
  if (sonuc.success) {
    // Okunmayan vurgu rengiyle video üretilmez (CLI'da da doğrulama hatası); para harcamadan önce burada söylenir.
    const vurgu = vurguHatasi(sonuc.data.vurguRengi, sonuc.data.tema ?? VARSAYILAN_TEMA);
    if (vurgu) return { basarili: false, hatalar: [`Vurgu rengi: ${vurgu} Renk şirket ayarlarında, tema ilanın görünüm bölümünde değiştirilir.`] };
    // Kapanış kartı bu üç bilgiyle kurulur (`iletisimBilgisi`); onaysızsa video üretilemez.
    const { fiyatTl, telefon, yetkiBelgeNo } = sonuc.data;
    const onaysiz = [!fiyatTl.onayli && "fiyat", !telefon.onayli && "telefon", !yetkiBelgeNo.onayli && "yetki belge numarası"].filter(Boolean);
    if (onaysiz.length) {
      return {
        basarili: false,
        hatalar: [`Videonun kapanışında gösterilen ${onaysiz.join(", ")} doğrulanmalı: Bilgiler'de "Bu bilgiyi doğruladım" kutusunu işaretleyin.`],
      };
    }
    return { basarili: true, ilan: sonuc.data };
  }
  const hatalar = sonuc.error.issues.map((sorun) =>
    sorun.path[0] === "fotograflar" && sorun.code === "too_small" ? "En az bir fotoğraf yükleyin." : `${alanYolu(sorun.path, "İlan")}: ${sorun.message}`,
  );
  return { basarili: false, hatalar: [...new Set(hatalar)] };
}
