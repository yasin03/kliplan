import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { fiyatEkranMetni, konumEkranMetni, metrekareEkranMetni } from "../src/pipeline/bicim.js";
import { fotograflariHazirla } from "../src/pipeline/fotografHazirlama.js";
import { iletisimBilgisi, VideoVerisiHatasi, videoPropsOlustur } from "../src/pipeline/videoProps.js";
import { type Ilan, ilanSemasi } from "../src/schema/ilan.js";
import { sahneListesiSemasi } from "../src/schema/sahne.js";
import { geciciIlanKlasoru, TEMURLAR_KLASORU, temurlarVerisi } from "./yardimci.js";

const temurlar = (): Ilan => ilanSemasi.parse(temurlarVerisi());

describe("ekran biçimleri", () => {
  it("fiyat, metrekare ve konumu biçimlendiriyor", () => {
    expect(fiyatEkranMetni(4_500_000)).toBe("4.500.000 TL");
    expect(metrekareEkranMetni(65)).toBe("65 m²");
    expect(konumEkranMetni({ il: "Afyonkarahisar", ilce: "Merkez", mahalle: "Erkmen" })).toBe(
      "Erkmen, Merkez / Afyonkarahisar",
    );
  });
});

describe("kapanış bilgileri", () => {
  it("onaylı bilgileri ekran biçiminde veriyor", () => {
    expect(iletisimBilgisi(temurlar())).toEqual({
      fiyat: "4.500.000 TL",
      telefon: "0505 709 44 88",
      yetkiBelgeNo: "0300206",
      konum: "Erkmen, Merkez / Afyonkarahisar",
    });
  });

  it("onaysız konumu göstermiyor", () => {
    const ilan = temurlar();
    ilan.konum.onayli = false;
    expect(iletisimBilgisi(ilan).konum).toBeUndefined();
  });

  it("onaysız fiyat veya telefonla video üretmiyor", () => {
    const ilan = temurlar();
    ilan.fiyatTl.onayli = false;
    ilan.telefon.onayli = false;
    expect(() => iletisimBilgisi(ilan)).toThrow(VideoVerisiHatasi);
    expect(() => iletisimBilgisi(ilan)).toThrow("Kapanış sahnesi için fiyat, telefon onaylı olmalı.");
  });

  it("kira bilgisini hiçbir alanda taşımıyor", () => {
    const metin = JSON.stringify(iletisimBilgisi(temurlar()));
    expect(metin).not.toContain("25.000");
    expect(metin).not.toMatch(/kira/i);
  });
});

describe("fotoğraf hazırlama", () => {
  it("PNG'yi JPEG'e çeviriyor, EXIF yönünü uyguluyor ve büyük görseli küçültüyor", async () => {
    const veri = temurlarVerisi();
    veri.fotograflar = [
      { dosya: "yan.png", tur: "salon" },
      { dosya: "buyuk.jpg", tur: "bina" },
    ];
    const klasor = await geciciIlanKlasoru(veri);
    const fotograflar = path.join(klasor, "fotograflar");
    // 600x400 görsel, EXIF 6 = 90° döndürülmüş: doğru yön 400x600 olmalı.
    await sharp({ create: { width: 600, height: 400, channels: 4, background: "#123456" } })
      .withMetadata({ orientation: 6 })
      .png()
      .toFile(path.join(fotograflar, "yan.png"));
    await sharp({ create: { width: 4000, height: 3000, channels: 3, background: "#654321" } })
      .jpeg()
      .toFile(path.join(fotograflar, "buyuk.jpg"));

    const publicKlasoru = path.join(klasor, "public");
    const sonuc = await fotograflariHazirla(klasor, ilanSemasi.parse(veri), publicKlasoru);

    expect(sonuc.fotograflar["yan.png"]).toEqual({ src: "ilan/yan.jpg", genislik: 400, yukseklik: 600 });
    expect(sonuc.fotograflar["buyuk.jpg"]).toEqual({ src: "ilan/buyuk.jpg", genislik: 2160, yukseklik: 1620 });
    expect(sonuc.logo).toBeNull();
    await expect(readFile(path.join(publicKlasoru, "fontlar", "Inter-Variable.ttf"))).resolves.toBeDefined();
  });

  it("ofisin vurgu rengini video verisine taşıyor; verilmezse boş bırakıyor", () => {
    const hazirlik = { publicKlasoru: "", logo: null, muzik: null, kapanisResmi: null, fotograflar: { "01-bina.jpg": { src: "ilan/01-bina.jpg", genislik: 1, yukseklik: 1 } } };
    const sahneler = [{ fotograf: "01-bina.jpg", baslik: "a", disSes: "b", sureSn: 3 }];
    expect(videoPropsOlustur(ilanSemasi.parse({ ...temurlarVerisi(), vurguRengi: "#4FD1C5" }), sahneler, hazirlik).vurguRengi).toBe("#4FD1C5");
    expect(videoPropsOlustur(temurlar(), sahneler, hazirlik).vurguRengi).toBeUndefined();
  });

  it("sahnedeki fotoğraf ilan listesinde yoksa anlaşılır hata veriyor", () => {
    const hazirlik = { publicKlasoru: "", logo: null, muzik: null, kapanisResmi: null, fotograflar: {} };
    const sahneler = [{ fotograf: "yok.jpg", baslik: "a", disSes: "b", sureSn: 3 }];
    expect(() => videoPropsOlustur(temurlar(), sahneler, hazirlik)).toThrow(
      `Sahne 1: "yok.jpg" ilan.json'daki fotoğraf listesinde yok.`,
    );
  });
});

describe("örnek sahne dosyaları", () => {
  it("Temurlar örnek sahneleri ve uzun başlık test sahneleri şemaya uyuyor", async () => {
    for (const yol of [path.join(TEMURLAR_KLASORU, "ornek-sahneler.json"), "tests/veri/uzun-baslik-sahneler.json"]) {
      const veri = JSON.parse(await readFile(yol, "utf8")) as unknown;
      expect(sahneListesiSemasi.safeParse(veri).success).toBe(true);
    }
  });
});

describe("videoda gizlenen kapanış bilgileri", () => {
  it("gizlenen satırları vermiyor ve onaylarını aramıyor", () => {
    const ilan = { ...temurlar(), gizli: ["fiyat", "telefon", "konum"] as Ilan["gizli"] };
    ilan.fiyatTl.onayli = false;
    ilan.telefon.onayli = false;
    expect(iletisimBilgisi(ilan)).toEqual({ fiyat: undefined, telefon: undefined, yetkiBelgeNo: "0300206", konum: undefined });
  });

  it("gösterilen yetki belgesi onaysızsa üretmiyor", () => {
    const ilan = temurlar();
    ilan.yetkiBelgeNo.onayli = false;
    expect(() => iletisimBilgisi(ilan)).toThrow(VideoVerisiHatasi);
    expect(iletisimBilgisi({ ...ilan, gizli: ["yetkiBelgeNo"] }).yetkiBelgeNo).toBeUndefined();
  });
});
