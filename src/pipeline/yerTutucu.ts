import { gorunur, type Ilan } from "../schema/ilan.js";
import {
  fiyatEkranMetni,
  fiyatSesMetni,
  konumEkranMetni,
  konumSesMetni,
  metrekareEkranMetni,
  metrekareSesMetni,
} from "./bicim.js";

/** Yapay zekanın kullanabileceği yer tutucular. Değerleri yalnızca kod yerleştirir. */
export const YER_TUTUCULAR = ["fiyat", "telefon", "netM2", "konum"] as const;
export type YerTutucu = (typeof YER_TUTUCULAR)[number];

/** Dış seste okunmayan yer tutucular. Telefon yerine "<ofis>'u arayın" denir. */
export const SESTE_YASAK: readonly YerTutucu[] = ["telefon"];

export const YER_TUTUCU_DESENI = /\{\{\s*([^{}]*?)\s*\}\}/g;

export type YerTutucuDegeri = { ekran: string; ses: string; kaynak: string };

/**
 * İlandaki onaylı ve videoda gösterilen değerlerden yer tutucu tablosunu kurar. Onaysız veya gizlenen bir bilginin
 * yer tutucusu tabloya girmez; metinde kullanılırsa doğrulama hatası olur.
 */
export function yerTutucuTablosu(ilan: Ilan): Partial<Record<YerTutucu, YerTutucuDegeri>> {
  const tablo: Partial<Record<YerTutucu, YerTutucuDegeri>> = {};
  if (gorunur(ilan, "netM2")) {
    tablo.netM2 = { ekran: metrekareEkranMetni(ilan.netM2), ses: metrekareSesMetni(ilan.netM2), kaynak: "netM2" };
  }
  if (ilan.fiyatTl.onayli && gorunur(ilan, "fiyat")) {
    tablo.fiyat = {
      ekran: fiyatEkranMetni(ilan.fiyatTl.deger),
      ses: fiyatSesMetni(ilan.fiyatTl.deger),
      kaynak: "fiyatTl.deger",
    };
  }
  if (ilan.telefon.onayli && gorunur(ilan, "telefon")) {
    tablo.telefon = { ekran: ilan.telefon.deger, ses: "", kaynak: "telefon.deger" };
  }
  if (ilan.konum.onayli && gorunur(ilan, "konum")) {
    tablo.konum = { ekran: konumEkranMetni(ilan.konum), ses: konumSesMetni(ilan.konum), kaynak: "konum" };
  }
  return tablo;
}

export function yerTutuculariBul(metin: string): string[] {
  return [...metin.matchAll(YER_TUTUCU_DESENI)].map((e) => e[1] ?? "");
}

/** Yer tutucuları ekran ya da ses biçimiyle değiştirir. Bilinmeyen yer tutucuda hata fırlatır. */
export function yerTutuculariDoldur(
  metin: string,
  tablo: Partial<Record<YerTutucu, YerTutucuDegeri>>,
  hedef: "ekran" | "ses",
): string {
  return metin.replace(YER_TUTUCU_DESENI, (_tam, ad: string) => {
    const deger = tablo[ad as YerTutucu];
    if (!deger) throw new Error(`Bilinmeyen veya kullanılamayan yer tutucu: {{${ad}}}`);
    return deger[hedef];
  });
}
