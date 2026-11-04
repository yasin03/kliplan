import { mkdtemp, readdir, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ilanKlasorunuDogrula } from "../src/pipeline/dogrulama.js";
import { sahneleriSeslendir, sahneSuresi, SES_ONCESI_SN } from "../src/pipeline/seslendirme.js";
import { telaffuzSozlugu } from "../src/pipeline/telaffuz.js";
import { yerTutucuTablosu } from "../src/pipeline/yerTutucu.js";
import { kelimeZamanlari, ssmlKur } from "../src/providers/AzureTtsProvider.js";
import { MockTtsProvider } from "../src/providers/MockTtsProvider.js";
import { tema } from "../src/remotion/tema.js";
import { type Ilan, ilanSemasi } from "../src/schema/ilan.js";
import type { YzSenaryo } from "../src/schema/senaryo.js";
import { geciciIlanKlasoru, TEMURLAR_FOTOGRAFLARI, temurlarVerisi } from "./yardimci.js";

const temurlar = (): Ilan => ilanSemasi.parse(temurlarVerisi());
const geciciKlasor = () => mkdtemp(path.join(tmpdir(), "kliplan-ses-"));

const senaryo: YzSenaryo = {
  sahneler: [
    { fotograf: "01-bina.png", baslik: "Sıfır Bina", disSes: "{{konum}} konumunda iki artı bir daire.", ekranMetni: "{{konum}}" },
    { fotograf: "02-salon.png", baslik: "Salon", disSes: "Salon eşyalı sunuluyor.", ekranMetni: "Eşyalı · Net {{netM2}}" },
    {
      fotograf: "07-bina.png",
      baslik: "İletişim {{telefon}}",
      disSes: "Fiyatı {{fiyat}}. Temurlar Grup'u arayın.",
      ekranMetni: "Fiyat {{fiyat}}",
    },
  ],
};

describe("Azure SSML ve kelime zamanları", () => {
  it("telaffuz sözlüğünü SSML'e çeviriyor, özel karakterleri kaçırıyor ve konumları koruyor", () => {
    const metin = "Temurlar & Erkmen'de <ev>";
    const { ssml, konumlar } = ssmlKur(metin, { Temurlar: { ipa: "temuɾlaɾ" }, Erkmen: "Erk men" }, "tr-TR-EmelNeural");
    expect(ssml).toContain('<phoneme alphabet="ipa" ph="temuɾlaɾ">Temurlar</phoneme>');
    expect(ssml).toContain('<sub alias="Erk men">Erkmen</sub>\'de');
    expect(ssml).toContain("&amp; ");
    expect(ssml).toContain("&lt;ev&gt;");
    expect(konumlar).toHaveLength(ssml.length);
    expect(konumlar[ssml.indexOf("Erkmen</sub>")]).toBe(metin.indexOf("Erkmen"));
  });

  it("kelimenin içinde geçen sözlük girdisini değiştirmiyor", () => {
    expect(ssmlKur("Temurlarca", { Temurlar: "x" }, "s").ssml).not.toContain("<sub");
  });

  it("bozuk konumlu olayı metinde arayarak eşliyor", () => {
    const metin = "Temurlar Grup'u arayın";
    const { konumlar } = ssmlKur(metin, {}, "s");
    const bas = konumlar.indexOf(0);
    const zamanlar = kelimeZamanlari(
      [
        { text: "Temurlar", textOffset: bas, wordLength: 8, audioOffset: 0, duration: 5e6 },
        { text: '">Temurlar Grup\'u', textOffset: -1, wordLength: 23, audioOffset: 5e6, duration: 3e6 },
        { text: "arayın", textOffset: bas + 16, wordLength: 6, audioOffset: 8e6, duration: 4e6 },
      ],
      metin,
      konumlar,
    );
    expect(zamanlar.map((z) => metin.slice(z.baslangicKarakter, z.baslangicKarakter + z.uzunluk))).toEqual([
      "Temurlar",
      "Grup'u",
      "arayın",
    ]);
    expect(zamanlar[1]).toMatchObject({ baslangicSn: 0.5, bitisSn: 0.8 });
  });
});

describe("sahne seslendirme", () => {
  const ayarlar = async () => {
    const ilan = temurlar();
    return { senaryo, tablo: yerTutucuTablosu(ilan), sozluk: await telaffuzSozlugu(ilan), publicKlasoru: await geciciKlasor() };
  };

  it("sahne süresini sesin gerçek süresinden hesaplıyor; ses kesilmiyor", async () => {
    const saglayici = new MockTtsProvider();
    const sonuc = await sahneleriSeslendir({ ...(await ayarlar()), saglayici });
    const gecisSn = tema.hareket.gecisKare / tema.video.fps;
    for (const [i, sahne] of sonuc.sahneler.entries()) {
      const kelime = saglayici.istekler[i]!.metin.split(" ").length;
      const sesSonu = SES_ONCESI_SN + kelime * 0.4;
      const kapanis = i === sonuc.sahneler.length - 1;
      // Sonraki sahnenin geçişi başlamadan ses bitmiş olmalı.
      expect(sahne.sureSn - (kapanis ? 0 : gecisSn)).toBeGreaterThan(sesSonu);
      expect(Number.isInteger(Math.round(sahne.sureSn * tema.video.fps * 1000) / 1000)).toBe(true);
    }
    // Altta, dış sesten ayrı ve kod tarafından doldurulmuş kısa ekran metni durur.
    expect(sonuc.sahneler[0]!.altyazi).toBe("Erkmen, Merkez / Afyonkarahisar");
    expect(sonuc.sahneler[2]!.altyazi).toBe("Fiyat 4.500.000 TL");
    expect(sonuc.sahneler[0]!.disSes).toBe("Afyonkarahisar Merkez, Erkmen Mahallesi konumunda iki artı bir daire.");
    expect(sonuc.sahneler[2]!.baslik).toBe("İletişim 0505 709 44 88");
    expect(saglayici.istekler[2]!.sozluk).toHaveProperty("Temurlar");
  });

  it("aynı içerik ikinci kez seslendirilmiyor, --force ile yeniden üretiliyor", async () => {
    const a = await ayarlar();
    const ilk = new MockTtsProvider();
    const birinci = await sahneleriSeslendir({ ...a, saglayici: ilk });
    expect(birinci.apiCagrisi).toBe(3);

    const ikinci = new MockTtsProvider();
    const tekrar = await sahneleriSeslendir({ ...a, saglayici: ikinci });
    expect(ikinci.istekler).toHaveLength(0);
    expect(tekrar).toMatchObject({ apiCagrisi: 0, onbellekten: 3, tahminiMaliyetUsd: 0 });
    expect(tekrar.sahneler).toEqual(birinci.sahneler);

    const zorla = new MockTtsProvider();
    await sahneleriSeslendir({ ...a, saglayici: zorla, zorla: true });
    expect(zorla.istekler).toHaveLength(3);

    const dosyalar = await readdir(path.join(a.publicKlasoru, "ses"));
    expect(dosyalar.filter((d) => d.endsWith(".wav"))).toHaveLength(3);
    expect((await stat(path.join(a.publicKlasoru, birinci.sahneler[0]!.ses!.src))).size).toBeGreaterThan(44);
  });

  it("sözlük değişince ses yeniden üretiliyor", async () => {
    const a = await ayarlar();
    await sahneleriSeslendir({ ...a, saglayici: new MockTtsProvider() });
    const yeni = new MockTtsProvider();
    await sahneleriSeslendir({ ...a, sozluk: { ...a.sozluk, Salon: "salon" }, saglayici: yeni });
    expect(yeni.istekler).toHaveLength(3);
  });

  it("kapanış sahnesi okunabilmesi için daha uzun kalıyor", () => {
    expect(sahneSuresi(3, true)).toBeGreaterThan(sahneSuresi(3, false) + 1);
  });
});

describe("telaffuz ve müzik ayarları", () => {
  it("ilandaki telaffuz girdisi projedekinin önüne geçiyor", async () => {
    const dosya = path.join(await geciciKlasor(), "telaffuz.json");
    await writeFile(dosya, JSON.stringify({ Temurlar: "a", Erkmen: { ipa: "b" } }));
    const ilan = ilanSemasi.parse({ ...temurlarVerisi(), telaffuz: { Temurlar: "c" } });
    expect(await telaffuzSozlugu(ilan, dosya)).toEqual({ Temurlar: "c", Erkmen: { ipa: "b" } });
  });

  it("müzik için lisans bilgisi zorunlu", () => {
    expect(ilanSemasi.safeParse({ ...temurlarVerisi(), muzik: { dosya: "muzik.mp3" } }).success).toBe(false);
  });

  it("müzik dosyası yoksa hata, varsa lisans kontrolü için uyarı veriyor", async () => {
    const muzik = { dosya: "muzik.mp3", lisans: "Örnek lisans" };
    const eksik = await geciciIlanKlasoru({ ...temurlarVerisi(), muzik }, TEMURLAR_FOTOGRAFLARI);
    expect((await ilanKlasorunuDogrula(eksik)).rapor.hatalar.map((h) => h.alan)).toEqual(["Müzik"]);

    const tam = await geciciIlanKlasoru({ ...temurlarVerisi(), muzik }, TEMURLAR_FOTOGRAFLARI);
    await writeFile(path.join(tam, "muzik.mp3"), "ses");
    const { rapor } = await ilanKlasorunuDogrula(tam);
    expect(rapor.gecerli).toBe(true);
    expect(rapor.uyarilar.find((u) => u.alan === "Müzik")?.mesaj).toContain("Örnek lisans");
  });
});
