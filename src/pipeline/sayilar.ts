const ASAL: Record<number, string> = {
  0: "sıfır",
  1: "bir",
  2: "iki",
  3: "üç",
  4: "dört",
  5: "beş",
  6: "altı",
  7: "yedi",
  8: "sekiz",
  9: "dokuz",
  10: "on",
};

const SIRA: Record<number, string> = {
  1: "birinci",
  2: "ikinci",
  3: "üçüncü",
  4: "dördüncü",
  5: "beşinci",
  6: "altıncı",
  7: "yedinci",
  8: "sekizinci",
  9: "dokuzuncu",
  10: "onuncu",
};

const ONLAR = ["yirmi", "otuz", "kırk", "elli", "altmış", "yetmiş", "seksen", "doksan", "yüz", "bin", "milyon", "milyar"];

/** 0-10 arası sayının okunuşu; daha büyükse `undefined`. */
export const sayiKelimesi = (n: number): string | undefined => ASAL[n];
export const siraKelimesi = (n: number): string | undefined => SIRA[n];

/**
 * Metinde geçebilecek tüm yazıyla sayılar. "bir" hariç: Türkçede belirsizlik
 * sözcüğü olarak ("bir daire") sürekli kullanılır.
 */
export const TUM_SAYI_KELIMELERI: ReadonlySet<string> = new Set([
  ...Object.values(ASAL).filter((k) => k !== "bir"),
  ...Object.values(SIRA),
  ...ONLAR,
]);

/** İlandaki sayılardan, metinde yazıyla geçmesine izin verilen kelimeler. */
export function izinliSayiKelimeleri(sayilar: number[]): Set<string> {
  const izinli = new Set<string>();
  for (const n of sayilar) {
    const asal = sayiKelimesi(n);
    const sira = siraKelimesi(n);
    if (asal) izinli.add(asal);
    if (sira) izinli.add(sira);
  }
  return izinli;
}
