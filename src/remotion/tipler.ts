import type { TemaAdi } from "./temalar.js";

export const KOMPOZISYON_ID = "IlanVideosu";

export type Sahne = {
  /** İlan klasöründeki fotoğrafın dosya adı, ör. `02-salon.jpg`. */
  fotograf: string;
  baslik: string;
  /** Seslendirilecek metin (sayılar okunuşa göre, ör. "4 milyon 500 bin lira"). */
  disSes: string;
  /** Altta sahne boyunca sabit duran kısa ekran metni. Dış sesi tekrar etmez. Verilmezse dış ses metni gösterilir. */
  altyazi?: string | undefined;
  sureSn: number;
  /** Faz 4: sahnenin dış ses dosyası (`public` klasörüne göre) ve sahne başından itibaren başlama anı. */
  ses?: { src: string; baslangicSn: number } | undefined;
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
  /** Şirketin kapanışta göstermeyi seçtiği bilgiler (web, adres, yetkili, e-posta), ekrandaki haliyle. */
  ekSatirlar?: string[] | undefined;
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
  /** Renk teması. Verilmezse koyu tema. */
  tema?: TemaAdi | undefined;
  /** Ofise özel vurgu rengi (`#RRGGBB`). Verilmezse temanın kendi rengi kullanılır. */
  vurguRengi?: string | undefined;
  /** Kapanış sahnesinin arka planı (şirket resmi). Verilmezse sahnenin kendi fotoğrafı. */
  kapanisFotografi?: HazirFotograf | null | undefined;
  /** `public` klasörüne göre fon müziği yolu. Verilmezse müzik çalmaz. */
  muzik?: string | null | undefined;
};
