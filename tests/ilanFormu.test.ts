import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { type Ilan, ilanSemasi } from "../src/schema/ilan.js";
import { formuVeriyeCevir, ilanFormunuDogrula, ilanJsonuOlustur, telefonuBicimlendir, veriyiFormaCevir, type FormAlanlari } from "../src/veri/ilanFormu.js";

const GECERLI: FormAlanlari = {
  ilanNo: "1312273556",
  "yetkiBelgeNo.deger": "0300206",
  "yetkiBelgeNo.onayli": "on",
  "telefon.deger": "05057094488",
  "telefon.onayli": "on",
  "fiyatTl.deger": "4.500.000",
  "fiyatTl.onayli": "on",
  "konum.il": "Afyonkarahisar",
  "konum.ilce": "Merkez",
  "konum.mahalle": "Erkmen",
  "konum.onayli": "on",
  odaSayisi: "2+1",
  brutM2: "70",
  netM2: "65",
  binaYasi: "0",
  bulunduguKat: "3",
  katSayisi: "4",
  isitma: "Kombi (doğalgaz), yerden ısıtma",
  mutfak: "",
  esyali: "evet",
  krediyeUygun: "hayir",
  tapu: "Kat irtifaklı",
  ozellikler: "Cam balkon\nAsansör, Açık otopark\n\nAsansör",
};

describe("ilan formu", () => {
  it("geçerli formu ilan.json yapısına çeviriyor", () => {
    const sonuc = ilanFormunuDogrula(GECERLI);
    expect(sonuc.basarili).toBe(true);
    if (!sonuc.basarili) return;
    expect(sonuc.veri).toMatchObject({
      telefon: { deger: "0505 709 44 88", onayli: true },
      fiyatTl: { deger: 4500000, onayli: true },
      konum: { il: "Afyonkarahisar", mahalle: "Erkmen", onayli: true },
      brutM2: 70,
      esyali: true,
      krediyeUygun: false,
      ozellikler: ["Cam balkon", "Asansör", "Açık otopark"],
    });
    expect(sonuc.veri).not.toHaveProperty("mutfak");
    expect(sonuc.veri).not.toHaveProperty("kiraDurumu");
  });

  it("işaretlenmeyen onay kutusunu onaysız sayıyor", () => {
    const alanlar = { ...GECERLI };
    delete alanlar["fiyatTl.onayli"];
    const sonuc = ilanFormunuDogrula(alanlar);
    expect(sonuc.basarili && sonuc.veri.fiyatTl.onayli).toBe(false);
  });

  it("hataları formdaki alan adıyla ve Türkçe döndürüyor", () => {
    const sonuc = ilanFormunuDogrula({ ...GECERLI, "fiyatTl.deger": "4,5 milyon", "konum.il": " ", odaSayisi: "iki", "telefon.deger": "123" });
    expect(sonuc.basarili).toBe(false);
    if (sonuc.basarili) return;
    expect(sonuc.hatalar).toEqual({
      "fiyatTl.deger": "sayı olmalı",
      "konum.il": "zorunlu alan eksik",
      odaSayisi: "Oda sayısı '2+1' biçiminde olmalı",
      "telefon.deger": "Telefon '0505 709 44 88' biçiminde olmalı",
    });
  });

  it("kira tutarı yazılıp kullanım durumu seçilmezse uyarıyor", () => {
    const sonuc = ilanFormunuDogrula({ ...GECERLI, "kiraDurumu.kiraTl": "25.000" });
    expect(!sonuc.basarili && sonuc.hatalar["kiraDurumu.aciklama"]).toBe("zorunlu alan eksik");
  });

  it("kira durumunu onaysız olarak kaydediyor", () => {
    const sonuc = ilanFormunuDogrula({ ...GECERLI, "kiraDurumu.aciklama": "Kiracılı", "kiraDurumu.kiraTl": "25.000 TL" });
    expect(sonuc.basarili && sonuc.veri.kiraDurumu).toEqual({ aciklama: "Kiracılı", kiraTl: 25000, onayli: false });
  });

  it.each([
    ["0505 709 44 88", "0505 709 44 88"],
    ["505 709 4488", "0505 709 44 88"],
    ["+90 (505) 709-44-88", "0505 709 44 88"],
    ["12345", "12345"],
  ])("telefonu biçimlendiriyor: %s", (girdi, beklenen) => {
    expect(telefonuBicimlendir(girdi)).toBe(beklenen);
  });

  it("kayıtlı veriyi forma çevirip geri okuyunca aynı veri çıkıyor", async () => {
    const ornek = JSON.parse(await readFile(path.resolve(import.meta.dirname, "../ilanlar/temurlar/ilan.json"), "utf8"));
    const bilgiler: Partial<Ilan> = ilanSemasi.parse(ornek);
    delete bilgiler.fotograflar;
    delete bilgiler.emlakOfisi;
    const geri = ilanFormunuDogrula(veriyiFormaCevir(bilgiler));
    expect(geri.basarili && geri.veri).toEqual(bilgiler);
  });

  it("ondalıklı metrekareyi virgülle kabul ediyor", () => {
    expect(formuVeriyeCevir({ netM2: "65,5" }).netM2).toBe(65.5);
  });
});

describe("ilan.json oluşturma", () => {
  const veri = (() => {
    const sonuc = ilanFormunuDogrula(GECERLI);
    if (!sonuc.basarili) throw new Error("örnek geçersiz");
    return sonuc.veri;
  })();

  it("ofis adı ve fotoğraf sırasıyla pipeline'ın şemasına uyuyor", () => {
    const sonuc = ilanJsonuOlustur(veri, { ad: "Temurlar Grup" }, [
      { dosyaAdi: "a1b2c3d4.jpg", tur: "bina" },
      { dosyaAdi: "e5f6a7b8.jpg", tur: "salon" },
    ]);
    expect(sonuc.basarili).toBe(true);
    if (!sonuc.basarili) return;
    expect(sonuc.ilan.emlakOfisi).toBe("Temurlar Grup");
    expect(sonuc.ilan.fotograflar).toEqual([
      { dosya: "a1b2c3d4.jpg", tur: "bina" },
      { dosya: "e5f6a7b8.jpg", tur: "salon" },
    ]);
  });

  it("kapanış kartındaki bilgiler onaysızsa üretime izin vermiyor", () => {
    const onaysiz = { ...veri, telefon: { ...veri.telefon, onayli: false }, yetkiBelgeNo: { ...veri.yetkiBelgeNo, onayli: false } };
    const sonuc = ilanJsonuOlustur(onaysiz, { ad: "Temurlar Grup" }, [{ dosyaAdi: "a.jpg", tur: "bina" }]);
    expect(sonuc.basarili).toBe(false);
    expect(!sonuc.basarili && sonuc.hatalar[0]).toContain("telefon, yetki belge numarası doğrulanmalı");
  });

  it("fotoğraf yoksa ne yapılacağını söylüyor", () => {
    expect(ilanJsonuOlustur(veri, { ad: "Temurlar Grup" }, [])).toEqual({ basarili: false, hatalar: ["En az bir fotoğraf yükleyin."] });
  });

  it("eksik bilgiyi okunur alan adıyla bildiriyor", () => {
    const eksik: Partial<typeof veri> = { ...veri };
    delete eksik.fiyatTl;
    const sonuc = ilanJsonuOlustur(eksik, { ad: "Temurlar Grup" }, [{ dosyaAdi: "a.jpg", tur: "bina" }]);
    expect(sonuc).toEqual({ basarili: false, hatalar: ["Fiyat: zorunlu alan eksik"] });
  });
});
