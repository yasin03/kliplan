import { mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AdimHatasi, videoUret } from "../src/pipeline/uretim.js";
import type { videoyuRenderEt } from "../src/pipeline/render.js";
import { MockScriptProvider } from "../src/providers/MockScriptProvider.js";
import { MockTtsProvider } from "../src/providers/MockTtsProvider.js";
import { geciciIlanKlasoru, TEMURLAR_FOTOGRAFLARI, temurlarVerisi } from "./yardimci.js";

type RenderGirdisi = Parameters<typeof videoyuRenderEt>[0];

/** Chrome açmadan video ve kapak dosyası yazan sahte render. */
function sahteRender(secenekler: { hata?: boolean } = {}) {
  const cagrilar: RenderGirdisi[] = [];
  const renderEt = async (g: RenderGirdisi) => {
    cagrilar.push(g);
    if (secenekler.hata) throw new Error("Protocol error: Target closed");
    await writeFile(g.videoYolu, "video");
    for (const k of g.kareler ?? []) await writeFile(k.yol, "kapak");
    return { kareSayisi: 900, fps: 30, sureSn: 30 };
  };
  return { renderEt, cagrilar };
}

async function ortam(ilanVerisi: object = temurlarVerisi()) {
  const klasor = await geciciIlanKlasoru(ilanVerisi, TEMURLAR_FOTOGRAFLARI);
  const kok = await mkdtemp(path.join(tmpdir(), "kliplan-uretim-"));
  const senaryoSaglayici = new MockScriptProvider();
  const sesSaglayici = new MockTtsProvider();
  const temel = {
    klasor,
    ciktiKlasoru: path.join(kok, "cikti"),
    onbellekKlasoru: path.join(kok, "onbellek"),
    senaryoSaglayici,
    sesSaglayici,
    test: true,
  };
  return { temel, senaryoSaglayici, sesSaglayici };
}

describe("uçtan uca üretim", () => {
  it("video, kapak, senaryo ve kontrol raporunu üretiyor", async () => {
    const { temel } = await ortam();
    const render = sahteRender();
    const sonuc = await videoUret({ ...temel, renderEt: render.renderEt });

    expect((await readdir(temel.ciktiKlasoru)).sort()).toEqual(["kapak.jpg", "kontrol-raporu.md", "senaryo.json", "video.mp4"]);
    expect(render.cagrilar[0]!.kareler).toHaveLength(1);
    expect(render.cagrilar[0]!.props.sahneler.every((s) => s.ses)).toBe(true);

    const senaryo = JSON.parse(await readFile(sonuc.senaryoYolu, "utf8")) as { sahneler: { ses?: unknown }[]; test: boolean };
    expect(senaryo.test).toBe(true);
    expect(senaryo.sahneler.every((s) => s.ses)).toBe(true);

    const rapor = await readFile(sonuc.raporYolu, "utf8");
    expect(rapor).toContain("TEST ÜRETİMİ");
    expect(rapor).toContain("| Fiyat | 4.500.000 TL | `fiyatTl.deger` |");
    expect(rapor).toContain("| Yetki belge no | 0300206 | `yetkiBelgeNo.deger` | kapanış kartı |");
    expect(rapor).toContain("| Net m² | 65 m² | `netM2` | sahne metni |");
    expect(rapor).toMatch(/⚠ \*\*Kira durumu:\*\* .*onaylı değil/);
    expect(rapor).toContain("Toplam tahmini API maliyeti: ~$0.0000");
    expect(rapor).toContain("- [ ] Video emlakçıya gönderilmeden önce baştan sona izlendi.");
    // Onaysız kira uyarı olarak raporda görünür ama sahnelere girmez.
    const sahneBolumu = rapor.split("## Sahneler")[1]!.split("## Göndermeden")[0]!;
    expect(sahneBolumu).not.toMatch(/kira|25\.000/i);
  });

  it("ikinci çalıştırmada API'ye ve render'a gitmiyor; --force ile hepsini yeniliyor", async () => {
    const { temel } = await ortam();
    const render = sahteRender();
    await videoUret({ ...temel, renderEt: render.renderEt });

    const senaryo2 = new MockScriptProvider();
    const ses2 = new MockTtsProvider();
    const ikinci = await videoUret({ ...temel, senaryoSaglayici: senaryo2, sesSaglayici: ses2, renderEt: render.renderEt });
    expect(senaryo2.istekler).toHaveLength(0);
    expect(ses2.istekler).toHaveLength(0);
    expect(render.cagrilar).toHaveLength(1);
    expect(ikinci.renderOnbellekten).toBe(true);
    expect(await readFile(ikinci.raporYolu, "utf8")).toContain("yeniden render edilmedi");

    const senaryo3 = new MockScriptProvider();
    const ses3 = new MockTtsProvider();
    await videoUret({ ...temel, senaryoSaglayici: senaryo3, sesSaglayici: ses3, renderEt: render.renderEt, zorla: true });
    expect(senaryo3.istekler).toHaveLength(1);
    expect(ses3.istekler.length).toBeGreaterThan(0);
    expect(render.cagrilar).toHaveLength(2);
  });

  it("yarıda kalan render'ı hangi adımda olduğu ve çözümüyle bildiriyor; tekrar çalıştırınca devam ediyor", async () => {
    const { temel } = await ortam();
    const hata = await videoUret({ ...temel, renderEt: sahteRender({ hata: true }).renderEt }).catch((e: unknown) => e);
    expect(hata).toBeInstanceOf(AdimHatasi);
    expect((hata as AdimHatasi).adim).toBe("5/6 Render");
    expect((hata as AdimHatasi).cozum).toContain("önceki adımlar önbellekten gelir");
    expect(await readdir(temel.ciktiKlasoru)).not.toContain("video.mp4");

    const senaryo2 = new MockScriptProvider();
    const ses2 = new MockTtsProvider();
    const render = sahteRender();
    await videoUret({ ...temel, senaryoSaglayici: senaryo2, sesSaglayici: ses2, renderEt: render.renderEt });
    expect(senaryo2.istekler).toHaveLength(0);
    expect(ses2.istekler).toHaveLength(0);
    expect(render.cagrilar).toHaveLength(1);
  });

  it("onaysız telefonla, API'ye hiç gitmeden doğrulama adımında duruyor", async () => {
    const veri = { ...temurlarVerisi(), telefon: { deger: "0505 709 44 88", onayli: false } };
    const { temel, senaryoSaglayici } = await ortam(veri);
    const hata = await videoUret({ ...temel, renderEt: sahteRender().renderEt }).catch((e: unknown) => e);
    expect((hata as AdimHatasi).adim).toBe("1/6 Doğrulama");
    expect((hata as AdimHatasi).message).toContain("telefon");
    expect(senaryoSaglayici.istekler).toHaveLength(0);
  });

  it("farklı bir ilanı kod değiştirmeden üretiyor", async () => {
    const veri = {
      ...temurlarVerisi(),
      ilanNo: "100200300",
      emlakOfisi: "Defne Emlak",
      odaSayisi: "3+1",
      netM2: 110,
      brutM2: 125,
      binaYasi: 8,
      bulunduguKat: 2,
      katSayisi: 5,
      konum: { il: "İzmir", ilce: "Bornova", mahalle: "Kazımdirik", onayli: true },
      esyali: false,
      kiraDurumu: undefined,
      ozellikler: ["Asansör", "Kapalı otopark", "Ebeveyn banyo"],
    };
    const { temel } = await ortam(veri);
    const sonuc = await videoUret({ ...temel, renderEt: sahteRender().renderEt });
    const rapor = await readFile(sonuc.raporYolu, "utf8");
    expect(rapor).toContain("# Kontrol raporu: Defne Emlak · ilan 100200300");
    expect(rapor).toContain("Kazımdirik, Bornova / İzmir");
    expect(rapor).toContain("Defne Emlak'ı arayın");
    expect(rapor).not.toContain("Temurlar");
  });
});
