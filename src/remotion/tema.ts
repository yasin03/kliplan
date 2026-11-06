/** Videonun yazı, yerleşim ve hareket ayarları. Renkler temaya göre değişir: `temalar.ts`. */
export const tema = {
  video: {
    genislik: 1080,
    yukseklik: 1920,
    fps: 30,
  },
  yazi: {
    aile: "Inter",
    /** Yerel font dosyası `public/` klasörüne göre. Lisans: public/fontlar/Inter-OFL.txt */
    dosya: "fontlar/Inter-Variable.ttf",
  },
  /**
   * Reels, TikTok ve Shorts arayüzünün (üstte sekmeler, altta açıklama, sağda butonlar) büyük ölçüde
   * kapatmadığı alan. Piksel cinsinden, 1080x1920 tuval için. Boş görünmesin diye platform önerisinden
   * (üst ~220, alt ~420) dar tutuldu: üstteki ofis adı ve alttaki ekran metni arayüze kısmen yaklaşabilir.
   */
  guvenliAlan: {
    ust: 110,
    alt: 260,
    sol: 64,
    sag: 64,
    /** Alt bölgede sağdaki beğen/yorum butonları için ek boşluk. */
    sagAlt: 150,
  },
  hareket: {
    /** Sahneler arası geçiş süresi (kare). */
    gecisKare: 15,
    /** Fotoğrafın sahne boyunca ulaştığı en büyük ölçek. */
    yakinlasma: 1.08,
    /** Kaydırma miktarı (piksel). */
    kaydirma: 40,
  },
  ses: {
    /** Fon müziğinin dış sesin altındaki seviyesi (0-1). */
    muzikSeviyesi: 0.1,
    /** Müziğin başta açılma ve sonda kısılma süresi (saniye). */
    muzikGecisSn: 1.5,
  },
  /** Genişlik/yükseklik oranı bunun altındaki (9:16’ya yakın) fotoğraflar ekranı kaplar; diğerleri (3:4 dahil) kırpılmadan bulanık dolgu üzerinde gösterilir. */
  dikeyOranSiniri: 0.65,
} as const;
