import { describe, expect, it } from "vitest";
import { kelimeSayisi, senaryoyuDogrula } from "../src/pipeline/senaryoDogrulama.js";
import { yerTutucuTablosu } from "../src/pipeline/yerTutucu.js";
import { kalipSenaryo } from "../src/providers/MockScriptProvider.js";
import { yzGirdisiOlustur } from "../src/pipeline/senaryoIstemi.js";
import { type Ilan, ilanSemasi } from "../src/schema/ilan.js";
import type { YzSenaryo } from "../src/schema/senaryo.js";
import { temurlarVerisi } from "./yardimci.js";

const temurlar = (): Ilan => ilanSemasi.parse(temurlarVerisi());
const baglam = (ilan = temurlar()) => ({ ilan, tablo: yerTutucuTablosu(ilan) });

/** Kurallara uyan, elle yazılmış örnek. Testler bunun tek bir yerini bozar. */
function gecerliSenaryo(): YzSenaryo {
  return {
    sahneler: [
      {
        fotograf: "01-bina.png",
        baslik: "Sıfır binada iki artı bir",
        disSes: "{{konum}} konumunda, yeni yapılmış bir binada eşyalı, iki artı bir daire.",
        ekranMetni: "{{konum}}",
      },
      {
        fotograf: "02-salon.png",
        baslik: "Eşyalı salon",
        disSes: "Salon koltuk takımıyla birlikte eşyalı. Net kullanım alanı {{netM2}}.",
        ekranMetni: "Eşyalı · Net {{netM2}}",
      },
      {
        fotograf: "03-mutfak.png",
        baslik: "Açık Amerikan mutfak",
        disSes: "Açık Amerikan mutfakta ankastre set, buzdolabı ve bulaşık makinesi bulunuyor.",
        ekranMetni: "Ankastre set · Bulaşık makinesi",
      },
      {
        fotograf: "04-yatak-odasi.png",
        baslik: "Yerden ısıtma",
        disSes: "Isınma doğalgazlı kombi ve yerden ısıtmayla sağlanıyor.",
        ekranMetni: "Kombi · Yerden ısıtma",
      },
      {
        fotograf: "05-koridor.png",
        baslik: "Hilton banyo",
        disSes: "Dairede Hilton banyo ve cam balkon, binada asansör ve görüntülü diyafon var.",
        ekranMetni: "Cam balkon · Asansör",
      },
      {
        fotograf: "07-bina.png",
        baslik: "Fiyat: {{fiyat}}",
        disSes: "Fiyatı {{fiyat}}, daire krediye uygun. Ayrıntılı bilgi için Temurlar Grup'u arayın.",
        ekranMetni: "Krediye uygun · {{telefon}}",
      },
    ],
  };
}

function bozulmus(degistir: (s: YzSenaryo) => void): YzSenaryo {
  const s = gecerliSenaryo();
  degistir(s);
  return s;
}

const hatalar = (cikti: unknown, b = baglam()) => senaryoyuDogrula(cikti, b).hatalar;

describe("senaryo doğrulaması", () => {
  it("kurallara uyan senaryoyu kabul ediyor", () => {
    expect(hatalar(gecerliSenaryo())).toEqual([]);
  });

  it("sahte sağlayıcının Temurlar senaryosu kurallara uyuyor", () => {
    const b = baglam();
    expect(hatalar(kalipSenaryo(yzGirdisiOlustur(b.ilan, b.tablo)), b)).toEqual([]);
  });

  it("bilinçli olarak yanlış bilgi içeren çıktıyı birden çok nedenle reddediyor", () => {
    const yanlis = bozulmus((s) => {
      s.sahneler[0]!.disSes = "Erkmen'de, deniz manzaralı ve havuzlu sitede üç artı bir kaçırılmaz bir fırsat.";
      s.sahneler[1]!.disSes = "Salon otuz beş metrekare, aylık kira getirisi yüksek.";
      s.sahneler[5]!.disSes = "Fiyatı sadece 4.500.000 TL. Hemen 0505 709 44 88 numarasını arayın.";
    });
    const h = hatalar(yanlis).join("\n");
    expect(h).toContain('konum adı ("Erkmen") doğrudan yazılamaz');
    expect(h).toContain('ilanda olmayan bir özellikten söz ediliyor: "deniz"');
    expect(h).toContain('ilanda olmayan bir özellikten söz ediliyor: "havuz"');
    expect(h).toContain('ilanda olmayan bir özellikten söz ediliyor: "manzara"');
    expect(h).toContain('oda sayısı ilandakinden farklı: "üç artı bir" (ilanda "iki artı bir")');
    expect(h).toContain('"kaçırılmaz"');
    expect(h).toContain('"fırsat"');
    expect(h).toContain('"otuz"');
    expect(h).toContain('"metrekare" doğrudan yazılamaz');
    expect(h).toContain('onaylı olmayan veya ilanda olmayan bilgi (kira durumu) kullanılamaz: "kira"');
    expect(h).toContain('"getiri"');
    expect(h).toContain("rakam kullanılamaz");
    expect(h).toContain('"Temurlar Grup" adı geçmeli');
  });

  it("rakam içeren ofis adını rakam sayımıyor, ofis adı dışındaki rakamı yine yakalıyor", () => {
    const ilan = { ...temurlar(), emlakOfisi: "Emlak 360" };
    const senaryo = bozulmus((s) => {
      for (const sahne of s.sahneler) sahne.disSes = sahne.disSes.replaceAll("Temurlar Grup", "Emlak 360");
      for (const sahne of s.sahneler) sahne.ekranMetni = sahne.ekranMetni.replaceAll("Temurlar Grup", "Emlak 360");
    });
    expect(hatalar(senaryo, baglam(ilan))).toEqual([]);
    senaryo.sahneler[0]!.disSes += " 3 dakika uzaklıkta.";
    expect(hatalar(senaryo, baglam(ilan)).join("\n")).toContain("Sahne 1 dış ses: rakam kullanılamaz (3)");
  });

  it("ekran metnini başlıkla aynı kurallarla denetliyor; uzunluk ve tekrar sınırı var", () => {
    const h = hatalar(
      bozulmus((s) => {
        s.sahneler[0]!.ekranMetni = "Erkmen'de kaçırılmaz fırsat";
        s.sahneler[1]!.ekranMetni = "Net 65 m²";
        s.sahneler[2]!.ekranMetni = "Ankastre set, buzdolabı, bulaşık makinesi ve çamaşır makinesi";
        s.sahneler[3]!.ekranMetni = "Yerden ısıtma";
        s.sahneler[4]!.ekranMetni = "";
      }),
    ).join("\n");
    expect(h).toContain('Sahne 1 ekran metni: konum adı ("Erkmen") doğrudan yazılamaz');
    expect(h).toContain('Sahne 1 ekran metni: abartılı veya doğrulanamayan ifade kullanılamaz: "fırsat"');
    expect(h).toContain("Sahne 2 ekran metni: rakam kullanılamaz");
    expect(h).toContain("Sahne 3 ekran metni: en fazla 40 karakter olmalı");
    expect(h).toContain("Sahne 4 ekran metni: başlığı veya dış sesi tekrar etmemeli");
    expect(h).toContain("Sahne 5: ekran metni boş.");
  });

  it("ekran metninde telefon yer tutucusuna izin veriyor", () => {
    expect(hatalar(gecerliSenaryo())).toEqual([]);
    expect(gecerliSenaryo().sahneler.at(-1)!.ekranMetni).toContain("{{telefon}}");
  });

  it("son sahnede fiyat yoksa reddediyor", () => {
    const h = hatalar(bozulmus((s) => {
      s.sahneler[5]!.baslik = "İletişim";
      s.sahneler[5]!.disSes = "Daire krediye uygun. Ayrıntılı bilgi için Temurlar Grup'u arayın.";
    }));
    expect(h).toContain("Son sahne: fiyat {{fiyat}} yer tutucusuyla yer almalı.");
  });

  it("bilinmeyen yer tutucuyu reddediyor", () => {
    const h = hatalar(bozulmus((s) => (s.sahneler[1]!.disSes += " Kirası {{kira}}.")));
    expect(h.join()).toContain("bilinmeyen yer tutucu {{kira}}");
  });

  it("onaysız bilginin yer tutucusunu reddediyor", () => {
    const ilan = temurlar();
    ilan.konum.onayli = false;
    const h = hatalar(gecerliSenaryo(), baglam(ilan));
    expect(h).toContain("Sahne 1 dış ses: {{konum}} onaylı olmayan bir bilgiye ait, kullanılamaz.");
  });

  it("onaysız kira bilgisini her biçimde reddediyor", () => {
    for (const ifade of ["Daire kiracılı.", "Kirası düzenli ödeniyor.", "Şu an kiracı var."]) {
      const h = hatalar(bozulmus((s) => (s.sahneler[4]!.disSes = ifade)));
      expect(h.join(), ifade).toContain("(kira durumu)");
    }
  });

  it("kira onaylıysa 'kiracılı' demeye izin veriyor ama tutarı yine yazdırmıyor", () => {
    const ilan = temurlar();
    ilan.kiraDurumu!.onayli = true;
    expect(hatalar(bozulmus((s) => (s.sahneler[4]!.disSes = "Daire şu an kiracılı, Hilton banyo ve cam balkon var.")), baglam(ilan)).join()).not.toContain("kira");
    expect(hatalar(bozulmus((s) => (s.sahneler[4]!.disSes = "Kirası yirmi beş bin lira.")), baglam(ilan)).join()).toContain('"lira"');
  });

  it("telefonu dış seste reddediyor, başlıkta kabul ediyor", () => {
    const sesteHata = hatalar(bozulmus((s) => (s.sahneler[5]!.disSes += " Numara {{telefon}}.")));
    expect(sesteHata.join()).toContain("{{telefon}} dış seste kullanılamaz");
    expect(hatalar(bozulmus((s) => (s.sahneler[5]!.baslik = "Tel: {{telefon}}")))).toEqual([]);
  });

  it("yer tutucuya ek getirilmesini reddediyor", () => {
    const h = hatalar(bozulmus((s) => (s.sahneler[0]!.disSes = s.sahneler[0]!.disSes.replace("{{konum}} konumunda", "{{konum}}'da"))));
    expect(h.join()).toContain("yer tutucuya ek getirilemez");
  });

  it("listede olmayan fotoğrafı reddediyor", () => {
    expect(hatalar(bozulmus((s) => (s.sahneler[2]!.fotograf = "08-banyo.jpg")))).toContain(
      'Sahne 3: "08-banyo.jpg" fotoğraf listesinde yok.',
    );
  });

  it("kelime sayısı sınırlarını uyguluyor", () => {
    const kisa = bozulmus((s) => s.sahneler.splice(1, 4));
    expect(hatalar(kisa).join()).toMatch(/55-70 kelime olmalı/);
    const uzun = bozulmus((s) => (s.sahneler[4]!.disSes = `${s.sahneler[4]!.disSes} `.repeat(4)));
    expect(hatalar(uzun).join()).toMatch(/55-70 kelime olmalı \(şu an \d+\)/);
  });

  it("çok uzun başlığı reddediyor", () => {
    const h = hatalar(bozulmus((s) => (s.sahneler[2]!.baslik = "Ankastre setli açık Amerikan mutfak ve fazlası")));
    expect(h.join()).toContain("en fazla 32 karakter");
  });

  it("ilanda olmayan doğrulanamayan nitelikleri reddediyor", () => {
    const h = hatalar(bozulmus((s) => (s.sahneler[1]!.disSes = "Geniş ve aydınlık salon eşyalı. Net kullanım alanı {{netM2}}.")));
    expect(h.join()).toContain('"geniş"');
    expect(h.join()).toContain('"aydınlık"');
  });

  it("şemaya uymayan çıktıyı anlaşılır şekilde reddediyor", () => {
    expect(hatalar("düz metin")).toEqual(["Şema: çıktı: nesne ({ ... }) olmalı"]);
    expect(hatalar({ sahneler: [{ fotograf: "01-bina.png", baslik: "x" }] })[0]).toContain("Dış ses");
  });

  it("yer tutucuları bir kelime sayıyor", () => {
    expect(kelimeSayisi("Fiyatı {{fiyat}}, {{konum}} konumunda.")).toBe(4);
  });
});
