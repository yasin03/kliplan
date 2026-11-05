import { describe, expect, it } from "vitest";
import { ilanVerisiniDogrula } from "../src/pipeline/dogrulama.js";
import { KontrolRaporu } from "../src/pipeline/kontrolRaporu.js";
import { alanYolu } from "../src/schema/hatalar.js";
import { temurlarVerisi } from "./yardimci.js";

function dogrula(veri: unknown) {
  const rapor = new KontrolRaporu();
  const ilan = ilanVerisiniDogrula(veri, rapor);
  return { ilan, rapor, mesajlar: rapor.hatalar.map((h) => `${h.alan}: ${h.mesaj}`) };
}

describe("ilan şeması", () => {
  it("Temurlar ilanını kabul ediyor", () => {
    const { ilan, rapor } = dogrula(temurlarVerisi());
    expect(rapor.hatalar).toEqual([]);
    expect(ilan?.fiyatTl.deger).toBe(4_500_000);
    expect(ilan?.konum.mahalle).toBe("Erkmen");
    expect(ilan?.fotograflar).toHaveLength(7);
  });

  it("Türkçe karakterleri bozmadan okuyor", () => {
    const { ilan } = dogrula(temurlarVerisi());
    expect(ilan?.isitma).toBe("Kombi (doğalgaz), yerden ısıtma");
    expect(ilan?.ozellikler).toContain("Çamaşır makinesi");
    expect(ilan?.ozellikler).toContain("Görüntülü diyafon");
  });

  it("eksik zorunlu alanı Türkçe adıyla bildiriyor", () => {
    const veri = temurlarVerisi();
    delete veri.emlakOfisi;
    expect(dogrula(veri).mesajlar).toEqual(["Emlak ofisi: zorunlu alan eksik"]);
  });

  it("yanlış türü anlaşılır şekilde bildiriyor", () => {
    const veri = temurlarVerisi();
    veri.netM2 = "65";
    expect(dogrula(veri).mesajlar).toEqual(["Net metrekare: sayı olmalı"]);
  });

  it("iç içe alanların yolunu gösteriyor", () => {
    const veri = temurlarVerisi();
    (veri.fiyatTl as Record<string, unknown>).deger = -5;
    (veri.konum as Record<string, unknown>).mahalle = "  ";
    expect(dogrula(veri).mesajlar).toEqual([
      "Fiyat → Değer: 0 değerinden büyük olmalı",
      "Konum → Mahalle: boş bırakılamaz",
    ]);
  });

  it("hatalı telefon biçimini reddediyor", () => {
    const veri = temurlarVerisi();
    (veri.telefon as Record<string, unknown>).deger = "05057094488";
    expect(dogrula(veri).mesajlar).toEqual(["Telefon → Değer: Telefon '0505 709 44 88' biçiminde olmalı"]);
  });

  it("bilinmeyen fotoğraf türünü ve sırasını bildiriyor", () => {
    const veri = temurlarVerisi();
    (veri.fotograflar as Record<string, unknown>[])[2]!.tur = "kiler";
    const [mesaj] = dogrula(veri).mesajlar;
    expect(mesaj).toMatch(/^Fotoğraflar → 3\. öğe → Fotoğraf türü: şunlardan biri olmalı: bina, salon/);
  });

  it("yazım hatası olan alanı tanınmayan alan olarak bildiriyor", () => {
    const veri = temurlarVerisi();
    veri.odaSaysi = "3+1";
    expect(dogrula(veri).mesajlar).toEqual(["ilan.json: tanınmayan alan: odaSaysi (yazım hatası olabilir)"]);
  });

  it("hatalı vurgu rengi biçimini reddediyor", () => {
    const { mesajlar } = dogrula({ ...temurlarVerisi(), vurguRengi: "turuncu" });
    expect(mesajlar).toEqual(["Vurgu rengi: Vurgu rengi '#F2A541' biçiminde olmalı"]);
  });

  it("boş fotoğraf listesini reddediyor", () => {
    const veri = temurlarVerisi();
    veri.fotograflar = [];
    expect(dogrula(veri).mesajlar).toEqual(["Fotoğraflar: en az 1 öğe içermeli"]);
  });

  it("klasör yolu içeren fotoğraf adını reddediyor", () => {
    const veri = temurlarVerisi();
    (veri.fotograflar as Record<string, unknown>[])[0]!.dosya = "../gizli.jpg";
    expect(dogrula(veri).mesajlar[0]).toContain("klasör yolu içermemeli");
  });

  it("JSON olmayan kök değeri reddediyor", () => {
    expect(dogrula([]).mesajlar).toEqual(["ilan.json: nesne ({ ... }) olmalı"]);
  });

  it("alan yolunu Türkçeleştiriyor", () => {
    expect(alanYolu(["fotograflar", 0, "dosya"])).toBe("Fotoğraflar → 1. öğe → Dosya adı");
  });
});
