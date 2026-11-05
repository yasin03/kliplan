import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { cozunurlukUyarisi, FotografHatasi, fotografiIsle } from "../src/veri/fotografIsleme.js";

const gorsel = (genislik: number, yukseklik: number) => sharp({ create: { width: genislik, height: yukseklik, channels: 3, background: "#336699" } });

describe("fotoğraf işleme", () => {
  it("büyük fotoğrafı küçültüp JPEG'e çeviriyor, dosya adını rastgele üretiyor", async () => {
    const sonuc = await fotografiIsle(await gorsel(4000, 3000).png().toBuffer());
    expect(sonuc).toMatchObject({ genislik: 2160, yukseklik: 1620, icerikTuru: "image/jpeg" });
    expect(sonuc.dosyaAdi).toMatch(/^[0-9a-f]{8}\.jpg$/);
    expect((await sharp(sonuc.icerik).metadata()).format).toBe("jpeg");
  });

  it("EXIF yönüne göre döndürüyor ve konum dahil EXIF bilgisini siliyor", async () => {
    // Yön 6: telefon dik tutulmuş, görüntü 90° döndürülerek gösterilmeli.
    const exifli = await gorsel(1600, 1200)
      .jpeg()
      .withMetadata({ orientation: 6 })
      .withExifMerge({ IFD0: { Make: "Telefon" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "38/1 45/1 0/1" } })
      .toBuffer();
    expect((await sharp(exifli).metadata()).exif?.toString("latin1")).toContain("Telefon");

    const sonuc = await fotografiIsle(exifli);
    expect([sonuc.genislik, sonuc.yukseklik]).toEqual([1200, 1600]);
    const bilgi = await sharp(sonuc.icerik).metadata();
    expect(bilgi.exif).toBeUndefined();
    expect(bilgi.orientation).toBeUndefined();
  });

  it("küçük fotoğrafı büyütmüyor ve çözünürlük uyarısı veriyor", async () => {
    const sonuc = await fotografiIsle(await gorsel(800, 600).jpeg().toBuffer());
    expect([sonuc.genislik, sonuc.yukseklik]).toEqual([800, 600]);
    expect(cozunurlukUyarisi(sonuc.genislik, sonuc.yukseklik)).toContain("Düşük çözünürlük (800×600)");
    expect(cozunurlukUyarisi(1920, 1080)).toBeNull();
  });

  it("görsel olmayan dosyayı içeriğinden tanıyıp reddediyor", async () => {
    await expect(fotografiIsle(Buffer.from("%PDF-1.7 sahte"))).rejects.toThrow(FotografHatasi);
  });

  it("desteklenmeyen biçimi anlaşılır mesajla reddediyor", async () => {
    await expect(fotografiIsle(await gorsel(100, 100).gif().toBuffer())).rejects.toThrow("Yalnızca JPEG, PNG ve WebP");
  });
});
