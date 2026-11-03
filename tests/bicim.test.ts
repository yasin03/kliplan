import { describe, expect, it } from "vitest";
import { fiyatEkranMetni, fiyatSesMetni, konumSesMetni, metrekareEkranMetni, metrekareSesMetni, tutarSesMetni } from "../src/pipeline/bicim.js";
import { yerTutuculariBul, yerTutuculariDoldur, yerTutucuTablosu } from "../src/pipeline/yerTutucu.js";
import { ilanSemasi } from "../src/schema/ilan.js";
import { temurlarVerisi } from "./yardimci.js";

describe("sayı biçimleri", () => {
  it("ekran ve ses biçimleri görev tanımındaki örneklerle aynı", () => {
    expect(fiyatEkranMetni(4_500_000)).toBe("4.500.000 TL");
    expect(fiyatSesMetni(4_500_000)).toBe("4 milyon 500 bin lira");
    expect(metrekareEkranMetni(65)).toBe("65 m²");
    expect(metrekareSesMetni(65)).toBe("65 metrekare");
  });

  it.each([
    [0, "0"],
    [750, "750"],
    [1_000, "bin"],
    [1_250, "bin 250"],
    [25_000, "25 bin"],
    [1_000_000, "1 milyon"],
    [1_500_000, "1 milyon 500 bin"],
    [12_345_678, "12 milyon 345 bin 678"],
    [2_001_000_000, "2 milyar 1 milyon"],
  ])("%i → %s", (sayi, beklenen) => {
    expect(tutarSesMetni(sayi)).toBe(beklenen);
  });

  it("konumu seslendirmeye uygun sırayla yazıyor", () => {
    expect(konumSesMetni({ il: "Afyonkarahisar", ilce: "Merkez", mahalle: "Erkmen" })).toBe(
      "Afyonkarahisar Merkez, Erkmen Mahallesi",
    );
  });
});

describe("yer tutucular", () => {
  const ilan = () => ilanSemasi.parse(temurlarVerisi());

  it("ekran ve ses için farklı değer yerleştiriyor", () => {
    const tablo = yerTutucuTablosu(ilan());
    const metin = "Fiyatı {{fiyat}}, net alan {{netM2}}.";
    expect(yerTutuculariDoldur(metin, tablo, "ekran")).toBe("Fiyatı 4.500.000 TL, net alan 65 m².");
    expect(yerTutuculariDoldur(metin, tablo, "ses")).toBe("Fiyatı 4 milyon 500 bin lira, net alan 65 metrekare.");
  });

  it("boşluklu yazımı da tanıyor", () => {
    expect(yerTutuculariBul("{{ fiyat }} ve {{netM2}}")).toEqual(["fiyat", "netM2"]);
  });

  it("onaysız bilginin yer tutucusunu tabloya koymuyor", () => {
    const i = ilan();
    i.fiyatTl.onayli = false;
    i.konum.onayli = false;
    const tablo = yerTutucuTablosu(i);
    expect(Object.keys(tablo).sort()).toEqual(["netM2", "telefon"]);
    expect(() => yerTutuculariDoldur("{{fiyat}}", tablo, "ekran")).toThrow("{{fiyat}}");
  });

  it("bilinmeyen yer tutucuda hata veriyor", () => {
    expect(() => yerTutuculariDoldur("{{kira}}", yerTutucuTablosu(ilan()), "ses")).toThrow("{{kira}}");
  });
});
