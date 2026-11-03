/** 4500000 → "4.500.000 TL" */
export const fiyatEkranMetni = (tl: number) => `${tl.toLocaleString("tr-TR")} TL`;

/** 65 → "65 m²" */
export const metrekareEkranMetni = (m2: number) => `${m2.toLocaleString("tr-TR")} m²`;

export const konumEkranMetni = (konum: { il: string; ilce: string; mahalle: string }) =>
  `${konum.mahalle}, ${konum.ilce} / ${konum.il}`;

/**
 * Dış ses için tutarı basamak gruplarına ayırır: 4500000 → "4 milyon 500 bin".
 * Türkçede "bir bin" denmediği için tek bin "bin" olarak yazılır.
 */
export function tutarSesMetni(sayi: number): string {
  if (!Number.isInteger(sayi) || sayi < 0) throw new Error(`Geçersiz tutar: ${sayi}`);
  if (sayi === 0) return "0";
  const gruplar: [number, string][] = [
    [1_000_000_000, "milyar"],
    [1_000_000, "milyon"],
    [1_000, "bin"],
  ];
  const parcalar: string[] = [];
  let kalan = sayi;
  for (const [deger, ad] of gruplar) {
    const adet = Math.floor(kalan / deger);
    if (adet > 0) parcalar.push(adet === 1 && ad === "bin" ? "bin" : `${adet} ${ad}`);
    kalan %= deger;
  }
  if (kalan > 0) parcalar.push(String(kalan));
  return parcalar.join(" ");
}

/** 4500000 → "4 milyon 500 bin lira" */
export const fiyatSesMetni = (tl: number) => `${tutarSesMetni(tl)} lira`;

/** 65 → "65 metrekare" */
export const metrekareSesMetni = (m2: number) => `${m2.toLocaleString("tr-TR")} metrekare`;

export const konumSesMetni = (konum: { il: string; ilce: string; mahalle: string }) =>
  `${konum.il} ${konum.ilce}, ${konum.mahalle} Mahallesi`;
