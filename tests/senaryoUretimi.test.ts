import { mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import type { GoogleGenAI } from "@google/genai";
import { describe, expect, it } from "vitest";
import { toplamKareSayisi } from "../src/remotion/hesap.js";
import { tema } from "../src/remotion/tema.js";
import { SenaryoHatasi, senaryoUret, sureleriTahminEt } from "../src/pipeline/senaryoUretimi.js";
import { yzGirdisiOlustur } from "../src/pipeline/senaryoIstemi.js";
import { yerTutucuTablosu } from "../src/pipeline/yerTutucu.js";
import { AnthropicScriptProvider } from "../src/providers/AnthropicScriptProvider.js";
import { GeminiScriptProvider } from "../src/providers/GeminiScriptProvider.js";
import { belirtmeHali, kalipSenaryo, MockScriptProvider } from "../src/providers/MockScriptProvider.js";
import { SaglayiciHatasi, type ScriptProvider } from "../src/providers/ScriptProvider.js";
import { type Ilan, ilanSemasi } from "../src/schema/ilan.js";
import { temurlarVerisi } from "./yardimci.js";

const temurlar = (): Ilan => ilanSemasi.parse(temurlarVerisi());
const gecerli = (ilan = temurlar()) => kalipSenaryo(yzGirdisiOlustur(ilan, yerTutucuTablosu(ilan)));
const hatali = () => ({ sahneler: [{ fotograf: "01-bina.png", baslik: "Fırsat", disSes: "Kaçırılmaz fırsat, 4 milyon.", ekranMetni: "Fırsat" }] });
const geciciKlasor = () => mkdtemp(path.join(tmpdir(), "kliplan-senaryo-"));

describe("senaryo üretimi", () => {
  it("sahte sağlayıcıyla API anahtarı olmadan çalışıyor", async () => {
    const sonuc = await senaryoUret({ ilan: temurlar(), saglayici: new MockScriptProvider() });
    expect(sonuc.denemeler).toHaveLength(1);
    expect(sonuc.toplamMaliyetUsd).toBe(0);
    expect(sonuc.sahneler.at(-1)!.disSes).toContain("4 milyon 500 bin lira");
    expect(sonuc.sahneler.at(-1)!.altyazi).toContain("4.500.000 TL");
    expect(sonuc.sahneler.at(-1)!.disSes).not.toContain("0505");
    expect(sonuc.kullanilanYerTutucular.map((y) => y.ad).sort()).toEqual(["fiyat", "konum", "netM2"]);
  });

  it("hatalı çıktıyı modele bildirip yeniden deniyor", async () => {
    const saglayici = new MockScriptProvider({ yanitlar: [hatali(), gecerli()] });
    const sonuc = await senaryoUret({ ilan: temurlar(), saglayici });
    expect(sonuc.denemeler).toHaveLength(2);
    expect(sonuc.denemeler[0]!.hatalar.length).toBeGreaterThan(0);
    const ikinci = saglayici.istekler[1]!;
    expect(ikinci.duzeltme?.hatalar).toEqual(sonuc.denemeler[0]!.hatalar);
    expect(ikinci.kullanici).toContain("Önceki çıktın kod tarafındaki kontrollerden geçemedi");
    expect(ikinci.kullanici).toContain('"fırsat"');
  });

  it("en fazla 2 kez yeniden deneyip nedenini yazarak duruyor", async () => {
    const saglayici = new MockScriptProvider({ yanitlar: [hatali(), hatali(), hatali(), gecerli()] });
    const hata = await senaryoUret({ ilan: temurlar(), saglayici }).catch((e: unknown) => e);
    expect(hata).toBeInstanceOf(SenaryoHatasi);
    expect(saglayici.istekler).toHaveLength(3);
    expect((hata as SenaryoHatasi).message).toContain("3 denemede kurallara uygun senaryo üretemedi");
    expect((hata as SenaryoHatasi).hatalar.join()).toContain("rakam kullanılamaz");
  });

  it("onaysız kira bilgisi ne yapay zekaya gidiyor ne videoya giriyor", async () => {
    const saglayici = new MockScriptProvider();
    const sonuc = await senaryoUret({ ilan: temurlar(), saglayici });
    const istem = JSON.stringify(saglayici.istekler[0]);
    expect(istem).not.toMatch(/kira/i);
    expect(istem).not.toContain("25000");
    const video = JSON.stringify(sonuc.sahneler);
    expect(video).not.toMatch(/kira/i);
    expect(video).not.toMatch(/25[.]?000|25 bin/);
  });

  it("kritik değerleri yapay zekaya göndermiyor", async () => {
    const saglayici = new MockScriptProvider();
    await senaryoUret({ ilan: temurlar(), saglayici });
    const istem = JSON.stringify(saglayici.istekler[0]);
    for (const deger of ["4500000", "4.500.000", "0505", "709 44 88", "0300206", "Erkmen", "Afyonkarahisar", "65"]) {
      expect(istem, deger).not.toContain(deger);
    }
  });

  it("geçerli sonucu önbelleğe alıyor ve ikinci çalıştırmada sağlayıcıyı çağırmıyor", async () => {
    const klasor = await geciciKlasor();
    const ilk = new MockScriptProvider();
    await senaryoUret({ ilan: temurlar(), saglayici: ilk, onbellekKlasoru: klasor });
    expect(await readdir(klasor)).toHaveLength(1);

    const ikinci = new MockScriptProvider();
    const sonuc = await senaryoUret({ ilan: temurlar(), saglayici: ikinci, onbellekKlasoru: klasor });
    expect(sonuc.onbellektenMi).toBe(true);
    expect(ikinci.istekler).toHaveLength(0);

    const zorla = new MockScriptProvider();
    await senaryoUret({ ilan: temurlar(), saglayici: zorla, onbellekKlasoru: klasor, zorla: true });
    expect(zorla.istekler).toHaveLength(1);
  });

  it("ilan değişince önbelleği kullanmıyor", async () => {
    const klasor = await geciciKlasor();
    await senaryoUret({ ilan: temurlar(), saglayici: new MockScriptProvider(), onbellekKlasoru: klasor });
    const degisik = temurlar();
    degisik.ozellikler = degisik.ozellikler.slice(0, 3);
    const saglayici = new MockScriptProvider();
    const sonuc = await senaryoUret({ ilan: degisik, saglayici, onbellekKlasoru: klasor });
    expect(sonuc.onbellektenMi).toBe(false);
    expect(saglayici.istekler).toHaveLength(1);
  });

  it("az bilgili başka bir ilan için de geçerli sahte senaryo üretiyor", async () => {
    const ilan = ilanSemasi.parse({
      ...temurlarVerisi(),
      emlakOfisi: "Ada Emlak",
      odaSayisi: "3+1",
      binaYasi: 12,
      bulunduguKat: 1,
      katSayisi: 5,
      isitma: undefined,
      mutfak: undefined,
      esyali: false,
      krediyeUygun: false,
      tapu: undefined,
      kiraDurumu: undefined,
      ozellikler: ["Asansör", "Ebeveyn banyo", "Kapalı otopark", "Güvenlik", "Çelik kapı", "Bahçe", "Kiler"],
    });
    const sonuc = await senaryoUret({ ilan, saglayici: new MockScriptProvider() });
    const metin = sonuc.sahneler.map((s) => s.disSes).join(" ");
    expect(metin).toContain("üç artı bir");
    expect(metin).toContain("Ada Emlak'ı arayın");
    expect(metin).not.toMatch(/eşyalı|kredi|sıfır/i);
  });
});

describe("süre tahmini", () => {
  it("toplam süreyi 20-30 saniye aralığında tutuyor", () => {
    for (const kelimeler of [[3, 3, 3, 3], [15, 15, 15, 15, 15, 15]]) {
      const sureler = sureleriTahminEt(kelimeler.map((n) => "kelime ".repeat(n)));
      const sn = toplamKareSayisi(sureler.map((sureSn) => ({ sureSn }))) / tema.video.fps;
      expect(sn).toBeGreaterThanOrEqual(19.9);
      expect(sn).toBeLessThanOrEqual(30);
    }
  });
});

describe("belirtme hali eki", () => {
  it.each([
    ["Temurlar Grup", "Temurlar Grup'u"],
    ["Ada Emlak", "Ada Emlak'ı"],
    ["Öz Mülk", "Öz Mülk'ü"],
    ["Ev Dünyası", "Ev Dünyası'yı"],
  ])("%s → %s", (ad, beklenen) => {
    expect(belirtmeHali(ad)).toBe(beklenen);
  });
});

describe("Anthropic sağlayıcısı", () => {
  type ParseParams = Record<string, unknown>;
  const sahteIstemci = (yanit: Record<string, unknown>, cagrilar: ParseParams[] = []) =>
    ({
      beta: {
        messages: {
          parse: (params: ParseParams) => {
            cagrilar.push(params);
            return Promise.resolve(yanit);
          },
        },
      },
    }) as unknown as Anthropic;

  const temelYanit = {
    stop_reason: "end_turn",
    stop_details: null,
    content: [],
    usage: { input_tokens: 1000, output_tokens: 2000, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
  };

  const istek = () => {
    const ilan = temurlar();
    return { sistem: "s", kullanici: "k", girdi: yzGirdisiOlustur(ilan, yerTutucuTablosu(ilan)) };
  };

  it("modeli, eforu, yedek modeli ve yapılandırılmış çıktıyı gönderiyor; maliyeti hesaplıyor", async () => {
    const cagrilar: ParseParams[] = [];
    const saglayici: ScriptProvider = new AnthropicScriptProvider({
      istemci: sahteIstemci({ ...temelYanit, parsed_output: { sahneler: [] } }, cagrilar),
    });
    const yanit = await saglayici.senaryoUret(istek());
    expect(cagrilar[0]).toMatchObject({
      model: "claude-opus-5-5",
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium" },
      system: "s",
    });
    expect(yanit.cikti).toEqual({ sahneler: [] });
    expect(yanit.kullanim).toEqual({ girdiToken: 1000, ciktiToken: 2000, tahminiMaliyetUsd: (1000 * 4 + 2000 * 20) / 1e6 });
    expect(saglayici.kimlik).toBe("anthropic:claude-opus-5-5:medium");
  });

  it("ayrıştırılamayan çıktıyı ham metin olarak doğrulamaya iletiyor", async () => {
    const saglayici = new AnthropicScriptProvider({
      istemci: sahteIstemci({ ...temelYanit, parsed_output: null, content: [{ type: "text", text: "bozuk" }] }),
    });
    expect((await saglayici.senaryoUret(istek())).cikti).toBe("bozuk");
  });

  it("reddedilen isteği Türkçe hata olarak bildiriyor", async () => {
    const saglayici = new AnthropicScriptProvider({
      istemci: sahteIstemci({ ...temelYanit, stop_reason: "refusal", stop_details: { category: null } }),
    });
    await expect(saglayici.senaryoUret(istek())).rejects.toThrow(SaglayiciHatasi);
  });

  it("Haiku için desteklenmeyen yedek model ayarını göndermiyor", async () => {
    const cagrilar: ParseParams[] = [];
    await new AnthropicScriptProvider({
      model: "claude-haiku-5-5",
      istemci: sahteIstemci({ ...temelYanit, parsed_output: {} }, cagrilar),
    }).senaryoUret(istek());
    expect(cagrilar[0]).not.toHaveProperty("fallbacks");
    expect(cagrilar[0]).not.toHaveProperty("betas");
  });
});

describe("Gemini sağlayıcısı", () => {
  type Params = Record<string, unknown>;
  const sahteIstemci = (yanit: Record<string, unknown>, cagrilar: Params[] = []) => ({
    models: {
      generateContent: (params: Params) => {
        cagrilar.push(params);
        return Promise.resolve(yanit);
      },
    },
  }) as unknown as GoogleGenAI;

  const temelYanit = (metin: string, finishReason = "STOP") => ({
    text: metin,
    candidates: [{ finishReason }],
    usageMetadata: { promptTokenCount: 1000, candidatesTokenCount: 1500, thoughtsTokenCount: 500 },
  });

  const istek = () => {
    const ilan = temurlar();
    return { sistem: "s", kullanici: "k", girdi: yzGirdisiOlustur(ilan, yerTutucuTablosu(ilan)) };
  };

  it("modeli, düşünme seviyesini ve JSON şemasını gönderiyor; çıktıyı ayrıştırıyor", async () => {
    const cagrilar: Params[] = [];
    const saglayici: ScriptProvider = new GeminiScriptProvider({
      istemci: sahteIstemci(temelYanit('{"sahneler":[]}'), cagrilar),
    });
    const yanit = await saglayici.senaryoUret(istek());
    expect(cagrilar[0]).toMatchObject({
      model: "gemini-3.8-flash",
      config: { systemInstruction: "s", responseMimeType: "application/json", thinkingConfig: { thinkingLevel: "MEDIUM" } },
    });
    expect((cagrilar[0]!.config as Params).responseJsonSchema).toMatchObject({ type: "object", required: ["sahneler"] });
    expect(yanit.cikti).toEqual({ sahneler: [] });
    expect(yanit.kullanim).toEqual({ girdiToken: 1000, ciktiToken: 2000, tahminiMaliyetUsd: 0 });
    expect(saglayici.kimlik).toBe("gemini:gemini-3.8-flash:medium");
  });

  it("ayrıştırılamayan çıktıyı ham metin olarak doğrulamaya iletiyor", async () => {
    const saglayici = new GeminiScriptProvider({ istemci: sahteIstemci(temelYanit("bozuk")) });
    expect((await saglayici.senaryoUret(istek())).cikti).toBe("bozuk");
  });

  it("güvenlik nedeniyle kesilen yanıtı Türkçe hata olarak bildiriyor", async () => {
    const saglayici = new GeminiScriptProvider({ istemci: sahteIstemci(temelYanit("", "SAFETY")) });
    await expect(saglayici.senaryoUret(istek())).rejects.toThrow(SaglayiciHatasi);
  });
});
