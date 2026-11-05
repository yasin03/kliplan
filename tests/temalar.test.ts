import { describe, expect, it } from "vitest";
import { ilanKlasorunuDogrula } from "../src/pipeline/dogrulama.js";
import { kontrastOrani, vurguHatasi } from "../src/pipeline/renk.js";
import { uretimRaporu } from "../src/pipeline/uretimRaporu.js";
import { videoPropsOlustur } from "../src/pipeline/videoProps.js";
import { TEMA_ADLARI, TEMALAR } from "../src/remotion/temalar.js";
import { ilanSemasi } from "../src/schema/ilan.js";
import { geciciIlanKlasoru, TEMURLAR_FOTOGRAFLARI, temurlarVerisi } from "./yardimci.js";

describe("temalar", () => {
  it("her temanın kendi vurgu rengi ve yazısı kendi zemininde okunuyor", () => {
    for (const ad of TEMA_ADLARI) {
      const t = TEMALAR[ad];
      expect(vurguHatasi(t.vurgu, ad), ad).toBeNull();
      expect(kontrastOrani(t.yazi, t.kart), ad).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("vurgu rengini her temanın kart zeminine göre ayrı kontrol ediyor", () => {
    // Amber lacivertte okunur, beyaz kartta okunmaz; koyu lacivert tersi.
    expect(vurguHatasi("#F2A541", "koyu")).toBeNull();
    expect(vurguHatasi("#F2A541", "acik")).toMatch(/açık temada okunmuyor .*Daha koyu bir renk/);
    expect(vurguHatasi("#1E3A8A", "koyu")).toMatch(/koyu temada okunmuyor .*Daha açık bir renk/);
    expect(vurguHatasi("#1E3A8A", "acik")).toBeNull();
    expect(vurguHatasi(undefined, "acik")).toBeNull();
  });

  it("ilan.json'da tema seçilebiliyor; bilinmeyen tema reddediliyor; video verisine geçiyor", () => {
    expect(ilanSemasi.safeParse({ ...temurlarVerisi(), tema: "acik" }).success).toBe(true);
    expect(ilanSemasi.safeParse({ ...temurlarVerisi(), tema: "mor" }).success).toBe(false);
    const hazirlik = { publicKlasoru: "", logo: null, muzik: null, kapanisResmi: null, fotograflar: { "01-bina.png": { src: "ilan/01-bina.jpg", genislik: 1, yukseklik: 1 } } };
    const sahneler = [{ fotograf: "01-bina.png", baslik: "a", disSes: "b", sureSn: 3 }];
    expect(videoPropsOlustur(ilanSemasi.parse({ ...temurlarVerisi(), tema: "sade" }), sahneler, hazirlik).tema).toBe("sade");
  });

  it("doğrulama vurgu rengini seçilen temaya göre kontrol ediyor", async () => {
    const acik = await ilanKlasorunuDogrula(await geciciIlanKlasoru({ ...temurlarVerisi(), tema: "acik", vurguRengi: "#F2A541" }, TEMURLAR_FOTOGRAFLARI));
    expect(acik.rapor.hatalar.map((h) => h.alan)).toEqual(["Vurgu rengi"]);
    const koyu = await ilanKlasorunuDogrula(await geciciIlanKlasoru({ ...temurlarVerisi(), vurguRengi: "#F2A541" }, TEMURLAR_FOTOGRAFLARI));
    expect(koyu.rapor.gecerli).toBe(true);
  });

  it("kontrol raporu tema, müzik lisansı ve beyanı yazıyor", () => {
    const ilan = ilanSemasi.parse({
      ...temurlarVerisi(),
      tema: "acik",
      vurguRengi: "#1E3A8A",
      muzik: { dosya: "muzik.mp3", lisans: "Artlist, sipariş 42", beyan: 'Ayşe Yılmaz, 5 Kasım 2026: "Beyan ederim."' },
    });
    const rapor = uretimRaporu({
      ilan,
      tarih: new Date(),
      test: false,
      senaryoSaglayici: "x",
      sesSaglayici: "y",
      sahneler: [],
      kullanilanYerTutucular: [],
      iletisim: { fiyat: "4.500.000 TL", telefon: "0505 709 44 88", yetkiBelgeNo: "1" },
      maddeler: [],
      sureSn: 25,
      dosyaBoyutuBayt: 1,
      maliyet: { senaryoUsd: 0, sesUsd: 0, senaryoOnbellekten: false, sesApiCagrisi: 0, sesOnbellekten: 0 },
      renderOnbellekten: false,
    });
    expect(rapor).toContain("- Tema: Açık · Vurgu rengi: #1E3A8A · Logo: yok");
    expect(rapor).toContain("- Ticari kullanım izni: Artlist, sipariş 42");
    expect(rapor).toContain('- Beyan: Ayşe Yılmaz, 5 Kasım 2026: "Beyan ederim."');
    expect(rapor).toContain("Müziğin ticari kullanım izni doğrulandı (Artlist, sipariş 42)");
  });
});
