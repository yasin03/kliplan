export const KOMPOZISYON_ID = "IlanVideosu";

export type Sahne = {
  /** İlan klasöründeki fotoğrafın dosya adı, ör. `02-salon.jpg`. */
  fotograf: string;
  baslik: string;
  /** Seslendirilecek metin (sayılar okunuşa göre, ör. "4 milyon 500 bin lira"). */
  disSes: string;
  /** Ekranda gösterilecek altyazı (ör. "4.500.000 TL"). Verilmezse dış ses metni gösterilir. */
  altyazi?: string | undefined;
  sureSn: number;
};

export type HazirFotograf = {
  /** Remotion `public` klasörüne göre yol. */
  src: string;
  genislik: number;
  yukseklik: number;
};

export type Iletisim = {
  /** Ekranda gösterilecek, kod tarafından biçimlendirilmiş değerler. */
  fiyat: string;
  telefon: string;
  yetkiBelgeNo: string;
  konum?: string | undefined;
};

export type VideoProps = {
  sahneler: Sahne[];
  /** Sahnelerdeki `fotograf` adlarından hazırlanmış dosyalara eşleme. */
  fotograflar: Record<string, HazirFotograf>;
  ofis: {
    ad: string;
    /** `public` klasörüne göre logo yolu. Yoksa yalnızca ofis adı gösterilir. */
    logo: string | null;
  };
  iletisim: Iletisim;
};
