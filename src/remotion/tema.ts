/** Videonun tüm renk, yazı ve yerleşim ayarları. Görünümü değiştirmek için yalnızca bu dosyayı düzenleyin. */
export const tema = {
  video: {
    genislik: 1080,
    yukseklik: 1920,
    fps: 30,
  },
  renkler: {
    lacivert: "#0B1F3A",
    lacivertKoyu: "#06132A",
    beyaz: "#FFFFFF",
    beyazSoluk: "rgba(255, 255, 255, 0.78)",
    /** Tek vurgu rengi: sıcak amber. */
    vurgu: "#F2A541",
  },
  yazi: {
    aile: "Inter",
    /** Yerel font dosyası `public/` klasörüne göre. Lisans: public/fontlar/Inter-OFL.txt */
    dosya: "fontlar/Inter-Variable.ttf",
  },
  /**
   * Reels, TikTok ve Shorts arayüzünün (üstte sekmeler, altta açıklama, sağda butonlar)
   * kapatmadığı alan. Piksel cinsinden, 1080x1920 tuval için.
   */
  guvenliAlan: {
    ust: 190,
    alt: 420,
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
  /** Genişlik/yükseklik oranı bunun altındaki (9:16’ya yakın) fotoğraflar ekranı kaplar; diğerleri (3:4 dahil) kırpılmadan bulanık dolgu üzerinde gösterilir. */
  dikeyOranSiniri: 0.65,
} as const;
