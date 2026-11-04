import type { z } from "zod";

/** Şema alanlarının kullanıcıya gösterilen Türkçe adları. */
const ALAN_ADLARI: Record<string, string> = {
  ilanNo: "İlan numarası",
  emlakOfisi: "Emlak ofisi",
  yetkiBelgeNo: "Yetki belge numarası",
  telefon: "Telefon",
  fiyatTl: "Fiyat",
  konum: "Konum",
  il: "İl",
  ilce: "İlçe",
  mahalle: "Mahalle",
  odaSayisi: "Oda sayısı",
  brutM2: "Brüt metrekare",
  netM2: "Net metrekare",
  binaYasi: "Bina yaşı",
  bulunduguKat: "Bulunduğu kat",
  katSayisi: "Kat sayısı",
  isitma: "Isıtma",
  mutfak: "Mutfak",
  esyali: "Eşyalı",
  krediyeUygun: "Krediye uygun",
  tapu: "Tapu",
  ozellikler: "Özellikler",
  kiraDurumu: "Kira durumu",
  aciklama: "Açıklama",
  kiraTl: "Kira tutarı",
  not: "Not",
  logo: "Logo",
  muzik: "Müzik",
  lisans: "Lisans",
  telaffuz: "Telaffuz",
  ipa: "IPA okunuşu",
  fotograflar: "Fotoğraflar",
  dosya: "Dosya adı",
  tur: "Fotoğraf türü",
  deger: "Değer",
  sahneler: "Sahneler",
  baslik: "Başlık",
  disSes: "Dış ses",
  altyazi: "Altyazı",
  sureSn: "Süre",
  ses: "Ses",
  ekranMetni: "Ekran metni",
  fotograf: "Fotoğraf",
  onayli: "Onay durumu",
};

const TUR_ADLARI: Record<string, string> = {
  string: "metin",
  number: "sayı",
  int: "tam sayı",
  boolean: "true veya false",
  object: "nesne ({ ... })",
  array: "liste ([ ... ])",
};

/** `["fotograflar", 2, "dosya"]` → `Fotoğraflar → 3. öğe → Dosya adı` */
export function alanYolu(yol: readonly PropertyKey[], kok = "ilan.json"): string {
  if (yol.length === 0) return kok;
  return yol
    .map((parca) => (typeof parca === "number" ? `${parca + 1}. öğe` : (ALAN_ADLARI[String(parca)] ?? String(parca))))
    .join(" → ");
}

/** Zod hatalarını Türkçeye çevirir. `safeParse(veri, { error: turkceHataHaritasi })` ile kullanılır. */
export const turkceHataHaritasi: z.core.$ZodErrorMap = (sorun) => {
  switch (sorun.code) {
    case "invalid_type":
      if (sorun.input === undefined) return "zorunlu alan eksik";
      return `${TUR_ADLARI[sorun.expected] ?? sorun.expected} olmalı`;
    case "invalid_value":
      return `şunlardan biri olmalı: ${sorun.values.map(String).join(", ")}`;
    case "too_small":
      if (sorun.origin === "string") return "boş bırakılamaz";
      if (sorun.origin === "array") return `en az ${sorun.minimum} öğe içermeli`;
      return sorun.inclusive ? `en az ${sorun.minimum} olmalı` : `${sorun.minimum} değerinden büyük olmalı`;
    case "too_big":
      return `en fazla ${sorun.maximum} olmalı`;
    case "unrecognized_keys":
      return `tanınmayan alan: ${sorun.keys.join(", ")} (yazım hatası olabilir)`;
    case "invalid_format":
      return "biçimi hatalı";
    default:
      return undefined;
  }
};

/** Her sorunu "Alan → yol: mesaj" biçiminde tek satıra çevirir. */
export function hatalariBicimlendir(hata: z.ZodError): string[] {
  return hata.issues.map((sorun) => `${alanYolu(sorun.path)}: ${sorun.message}`);
}
