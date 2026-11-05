/**
 * Hazır video temaları. Ofis varsayılan temayı seçer, ilan başına değiştirilebilir.
 * Logo ve ofisin vurgu rengi her temada kullanılır; vurgu renginin okunurluğu `kart` zeminine göre kontrol edilir.
 * Bu dosya Remotion'a bağlı değildir; web paneli ve doğrulama da kullanır.
 */
export const TEMA_ADLARI = ["koyu", "acik", "sade"] as const;
export type TemaAdi = (typeof TEMA_ADLARI)[number];

export const VARSAYILAN_TEMA: TemaAdi = "koyu";

export type Tema = {
  ad: string;
  aciklama: string;
  /** Video zemini (geçişlerde görünür) ve kapanış sahnesindeki perde. */
  zemin: string;
  /** Başlık ve altyazı okunsun diye fotoğrafın üst ve alt kenarına inen geçiş rengi. */
  karartma: string;
  /** Kapanış kartı ve altyazı kutusu. Fiyat bu zeminde vurgu renginde yazılır. */
  kart: string;
  yazi: string;
  yaziSoluk: string;
  ayrac: string;
  baslikGolgesi: string;
  /** Ofis vurgu rengi vermediyse. */
  vurgu: string;
  /** Kapanış kartı ve altyazı kutusunun köşe yarıçapı (piksel). */
  kose: number;
};

export const TEMALAR: Record<TemaAdi, Tema> = {
  koyu: {
    ad: "Koyu",
    aciklama: "Lacivert zemin, beyaz yazı",
    zemin: "#06132A",
    karartma: "#06132A",
    kart: "#0B1F3A",
    yazi: "#FFFFFF",
    yaziSoluk: "rgba(255, 255, 255, 0.78)",
    ayrac: "rgba(255, 255, 255, 0.18)",
    baslikGolgesi: "0 4px 24px rgba(0, 0, 0, 0.45)",
    vurgu: "#F2A541",
    kose: 40,
  },
  acik: {
    ad: "Açık",
    aciklama: "Krem zemin, koyu yazı",
    zemin: "#F4EFE6",
    karartma: "#F4EFE6",
    kart: "#FFFFFF",
    yazi: "#14213D",
    yaziSoluk: "rgba(20, 33, 61, 0.72)",
    ayrac: "rgba(20, 33, 61, 0.14)",
    baslikGolgesi: "0 2px 18px rgba(255, 255, 255, 0.7)",
    vurgu: "#C2410C",
    kose: 40,
  },
  sade: {
    ad: "Sade",
    aciklama: "Siyah zemin, ince köşeler",
    zemin: "#000000",
    karartma: "#000000",
    kart: "#141414",
    yazi: "#FFFFFF",
    yaziSoluk: "rgba(255, 255, 255, 0.7)",
    ayrac: "rgba(255, 255, 255, 0.16)",
    baslikGolgesi: "0 2px 16px rgba(0, 0, 0, 0.6)",
    vurgu: "#FFFFFF",
    kose: 12,
  },
};

export const temaAdiMi = (deger: unknown): deger is TemaAdi => (TEMA_ADLARI as readonly unknown[]).includes(deger);
