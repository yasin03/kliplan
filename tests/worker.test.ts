import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Veritabani } from "../src/db/baglanti.js";
import { ofis, uretimIsi } from "../src/db/sema.js";
import { YerelDepolama } from "../src/depolama/YerelDepolama.js";
import type { videoyuRenderEt } from "../src/pipeline/render.js";
import type { SenaryoSonucu } from "../src/pipeline/senaryoUretimi.js";
import { MockScriptProvider } from "../src/providers/MockScriptProvider.js";
import { MockTtsProvider } from "../src/providers/MockTtsProvider.js";
import { depoOlustur, DuzenlemeHatasi } from "../src/veri/depo.js";
import { ilanFormunuDogrula, veriyiFormaCevir } from "../src/veri/ilanFormu.js";
import { BulunamadiHatasi, ErisimHatasi, type Yetki } from "../src/veri/yetki.js";
import { AdimHatasi } from "../src/pipeline/uretim.js";
import { type IsBaglami, isiCalistir, isiHataylaKapat, kayitliHata } from "../src/worker/isler.js";
import { tablolariBosalt, testKullanicisi, testVeritabani } from "./veritabani.js";
import { gercekFotografGibi, temurlarVerisi } from "./yardimci.js";

const testDb = await testVeritabani("worker");

type RenderGirdisi = Parameters<typeof videoyuRenderEt>[0];
const sahteRender = async (g: RenderGirdisi) => {
  await writeFile(g.videoYolu, "video");
  for (const k of g.kareler ?? []) await writeFile(k.yol, "kapak");
  return { kareSayisi: 900, fps: 30, sureSn: 30 };
};

/** Temurlar ilanının formdan geçmiş hali (fotoğraflar ve ofis adı hariç). */
function ilanBilgileri() {
  const sonuc = ilanFormunuDogrula(veriyiFormaCevir(temurlarVerisi()));
  if (!sonuc.basarili) throw new Error(JSON.stringify(sonuc.hatalar));
  return sonuc.veri;
}

describe.skipIf(!testDb)("üretim işleri (worker)", () => {
  const db = testDb as Veritabani;
  let depolama: YerelDepolama;
  let baglam: IsBaglami;
  let a: Yetki;
  let b: Yetki;
  let foto: Buffer;

  beforeAll(async () => {
    depolama = new YerelDepolama(await mkdtemp(path.join(tmpdir(), "kliplan-worker-depo-")), "gizli");
    foto = await gercekFotografGibi();
  });

  beforeEach(async () => {
    await tablolariBosalt(db);
    const [ofisA, ofisB] = await db.insert(ofis).values([{ ad: "Temurlar Grup" }, { ad: "Defne Emlak" }]).returning();
    a = { kullaniciId: "a", ofisId: ofisA!.id, admin: false };
    b = { kullaniciId: "b", ofisId: ofisB!.id, admin: false };
    await testKullanicisi(db, "a", a.ofisId);
    await testKullanicisi(db, "b", b.ofisId);
    baglam = {
      db,
      depolama,
      senaryoSaglayici: new MockScriptProvider(),
      sesSaglayici: new MockTtsProvider(),
      onbellekKoku: await mkdtemp(path.join(tmpdir(), "kliplan-worker-onbellek-")),
      test: true,
      renderEt: sahteRender,
    };
  });

  afterAll(async () => {
    await db.$client.end();
  });

  const depo = (yetki: Yetki) => depoOlustur(db, yetki, depolama);

  async function hazirIlan(yetki = a) {
    const kayit = await depo(yetki).ilanOlustur(ilanBilgileri());
    for (const [i, tur] of ["bina", "salon", "mutfak", "yatak_odasi", "koridor"].entries()) {
      await depo(yetki).fotografEkle(kayit.id, { dosyaAdi: `${i}.jpg`, tur, icerik: foto, icerikTuru: "image/jpeg", genislik: 1600, yukseklik: 1200 });
    }
    return kayit;
  }

  it("senaryo işi senaryoyu ilana yazıyor, video işi sürüm açıp dosyaları depoya yüklüyor", async () => {
    const kayit = await hazirIlan();

    const senaryoIsi = await depo(a).uretimBaslat(kayit.id, "senaryo");
    expect((await depo(a).ilan(kayit.id)).durum).toBe("uretiliyor");
    await isiCalistir(baglam, senaryoIsi.id);

    const sonra = await depo(a).ilan(kayit.id);
    expect(sonra.durum).toBe("taslak");
    expect((sonra.senaryo as SenaryoSonucu).senaryo.sahneler.length).toBeGreaterThanOrEqual(4);
    expect(await depo(a).sonIs(kayit.id)).toMatchObject({ tur: "senaryo", durum: "tamamlandi" });

    for (const surum of [1, 2]) {
      const videoIsi = await depo(a).uretimBaslat(kayit.id, "video");
      await isiCalistir(baglam, videoIsi.id);
      const [son] = await depo(a).videolar(kayit.id);
      expect(son).toMatchObject({ surum, sureSn: 30 });
      expect((await depolama.oku(son!.videoAnahtari)).toString()).toBe("video");
      expect((await depolama.oku(son!.raporAnahtari)).toString()).toContain("TEST ÜRETİMİ");
      expect(son!.videoAnahtari).toBe(`ofis/${a.ofisId}/ilan/${kayit.id}/video/${surum}/video.mp4`);
    }
    expect((await depo(a).ilan(kayit.id)).durum).toBe("kontrol_bekliyor");
  });

  it("aynı ilanda ikinci işi başlatmıyor; başka ofisin ilanında iş başlatılamıyor", async () => {
    const kayit = await hazirIlan();
    await depo(a).uretimBaslat(kayit.id, "senaryo");
    await expect(depo(a).uretimBaslat(kayit.id, "senaryo")).rejects.toThrow("zaten sürüyor");
    await expect(depo(b).uretimBaslat(kayit.id, "senaryo")).rejects.toBeInstanceOf(BulunamadiHatasi);
    await expect(depo(b).sonIs(kayit.id)).rejects.toBeInstanceOf(BulunamadiHatasi);
    expect(await db.$count(uretimIsi)).toBe(1);
  });

  it("senaryosu olmayan ilanda video işi başlatılamıyor", async () => {
    const kayit = await hazirIlan();
    await expect(depo(a).uretimBaslat(kayit.id, "video")).rejects.toBeInstanceOf(DuzenlemeHatasi);
  });

  it("hata adımıyla kaydediliyor, ilan hata durumuna geçiyor ve yeniden denenebiliyor", async () => {
    const kayit = await hazirIlan();
    // Bilgileri eksik ilan: doğrulama adımında durmalı.
    await depo(a).ilanBilgileriniKaydet(kayit.id, { ...ilanBilgileri(), odaSayisi: undefined });
    const is1 = await depo(a).uretimBaslat(kayit.id, "senaryo");
    await expect(isiCalistir(baglam, is1.id)).rejects.toThrow();

    const hatali = await depo(a).ilan(kayit.id);
    expect(hatali.durum).toBe("hata");
    expect(hatali.hata).toMatchObject({ adim: "1/6 Doğrulama", cozum: expect.stringContaining("İlan bilgilerini") });
    expect(hatali.hata!.mesaj).toContain("Oda sayısı");
    expect(await depo(a).sonIs(kayit.id)).toMatchObject({ durum: "hata" });

    await depo(a).ilanBilgileriniKaydet(kayit.id, ilanBilgileri());
    const is2 = await depo(a).uretimBaslat(kayit.id, "senaryo");
    await isiCalistir(baglam, is2.id);
    expect(await depo(a).ilan(kayit.id)).toMatchObject({ durum: "taslak", hata: null });
  });

  it("render hatası panel için çözümle kaydediliyor; tekrar denemede senaryo ve ses önbellekten geliyor", async () => {
    const kayit = await hazirIlan();
    await isiCalistir(baglam, (await depo(a).uretimBaslat(kayit.id, "senaryo")).id);

    const bozuk = { ...baglam, renderEt: async () => Promise.reject(new Error("Protocol error: Target closed")) };
    const is1 = await depo(a).uretimBaslat(kayit.id, "video");
    await expect(isiCalistir(bozuk, is1.id)).rejects.toThrow();
    expect((await depo(a).ilan(kayit.id)).hata).toMatchObject({ adim: "5/6 Render", mesaj: "Protocol error: Target closed" });
    expect(await depo(a).videolar(kayit.id)).toHaveLength(0);

    const ses = new MockTtsProvider();
    const is2 = await depo(a).uretimBaslat(kayit.id, "video");
    await isiCalistir({ ...baglam, sesSaglayici: ses }, is2.id);
    expect(await depo(a).videolar(kayit.id)).toHaveLength(1);
    expect(ses.istekler).toHaveLength(0);
  });

  it("kayıtlı senaryo kurallara uymuyorsa video üretmiyor", async () => {
    const kayit = await hazirIlan();
    await isiCalistir(baglam, (await depo(a).uretimBaslat(kayit.id, "senaryo")).id);
    const senaryo = (await depo(a).ilan(kayit.id)).senaryo as SenaryoSonucu;
    senaryo.senaryo.sahneler[0]!.disSes = "Kaçırılmaz fırsat, 3 milyona!";
    await depo(a).senaryoKaydet(kayit.id, senaryo);

    const is = await depo(a).uretimBaslat(kayit.id, "video");
    await expect(isiCalistir(baglam, is.id)).rejects.toThrow();
    expect((await depo(a).ilan(kayit.id)).hata).toMatchObject({ adim: "3/6 Senaryo" });
  });

  it("yarıda kalan işi kapatmak tamamlanmış işi bozmuyor", async () => {
    const kayit = await hazirIlan();
    const is = await depo(a).uretimBaslat(kayit.id, "senaryo");
    await isiCalistir(baglam, is.id);
    await isiHataylaKapat(db, is.id, { adim: "Üretim", mesaj: "takıldı", cozum: "" });
    expect((await db.query.uretimIsi.findFirst({ where: eq(uretimIsi.id, is.id) }))!.durum).toBe("tamamlandi");
    expect((await depo(a).ilan(kayit.id)).durum).toBe("taslak");
  });

  describe("onay ve indirme", () => {
    async function videolu(test = false) {
      const kayit = await hazirIlan();
      const gercek = { ...baglam, test };
      await isiCalistir(gercek, (await depo(a).uretimBaslat(kayit.id, "senaryo")).id);
      await isiCalistir(gercek, (await depo(a).uretimBaslat(kayit.id, "video")).id);
      return { kayit, gercek, video: (await depo(a).videolar(kayit.id))[0]! };
    }

    it("onaylanan video ilanı onaylandı yapıyor, onaylayanı ve kontrol listesini kaydediyor", async () => {
      const { kayit, video } = await videolu();
      await expect(depo(a).videoIndirmeBaglantisi(video.id, "video")).rejects.toBeInstanceOf(ErisimHatasi);
      await expect(depo(a).videoIndirmeBaglantisi(video.id, "rapor")).resolves.toContain("indir=kliplan-kontrol-raporu-s1.md");

      await depo(a).videoOnayla(video.id, ["Video baştan sona izlendi."]);
      expect((await depo(a).ilan(kayit.id)).durum).toBe("onaylandi");
      expect((await depo(a).videolar(kayit.id))[0]).toMatchObject({ onaylayanId: "a", kontrolListesi: ["Video baştan sona izlendi."] });
      await expect(depo(a).videoIndirmeBaglantisi(video.id, "video")).resolves.toContain("indir=kliplan-video-s1.mp4");
      await expect(depo(a).videoOnayla(video.id, [])).rejects.toThrow("zaten onaylandı");
    });

    it("test üretimini, eski sürümü ve başka ofisin videosunu onaylamıyor", async () => {
      const test = await videolu(true);
      await expect(depo(a).videoOnayla(test.video.id, [])).rejects.toThrow("Test üretimi");

      const { kayit, gercek, video: ilk } = await videolu();
      await expect(depo(b).videoOnayla(ilk.id, [])).rejects.toBeInstanceOf(BulunamadiHatasi);
      await expect(depo(b).videoIndirmeBaglantisi(ilk.id, "rapor")).rejects.toBeInstanceOf(BulunamadiHatasi);
      await isiCalistir(gercek, (await depo(a).uretimBaslat(kayit.id, "video")).id);
      await expect(depo(a).videoOnayla(ilk.id, [])).rejects.toThrow("en son sürüm");
    });

    it("bilgiler değişince eski video onaylanamıyor; yeniden üretim onaylı ilanı tekrar kontrole düşürüyor", async () => {
      const { kayit, gercek, video } = await videolu();
      await depo(a).ilanBilgileriniKaydet(kayit.id, { ...ilanBilgileri(), mutfak: "Kapalı mutfak" });
      await expect(depo(a).videoOnayla(video.id, [])).rejects.toThrow("onaya hazır değil");

      await isiCalistir(gercek, (await depo(a).uretimBaslat(kayit.id, "senaryo")).id);
      await isiCalistir(gercek, (await depo(a).uretimBaslat(kayit.id, "video")).id);
      const [yeni] = await depo(a).videolar(kayit.id);
      await depo(a).videoOnayla(yeni!.id, []);
      await isiCalistir(gercek, (await depo(a).uretimBaslat(kayit.id, "video")).id);
      expect((await depo(a).ilan(kayit.id)).durum).toBe("kontrol_bekliyor");
      expect((await depo(a).videolar(kayit.id)).map((v) => [v.surum, Boolean(v.onayZamani)])).toEqual([
        [3, false],
        [2, true],
        [1, false],
      ]);
    });
  });
});

describe("panel hata metni", () => {
  it("yapay zeka yoğunluk (503) ve kota (429) hatasında beklemeyi söylüyor, diğer senaryo hatalarında düzenlemeyi", () => {
    const yogun = kayitliHata(new AdimHatasi("3/6 Senaryo", 'Gemini API hatası (503): {"error":{"code":503}}', ""));
    expect(yogun.cozum).toContain("çok yoğun");
    expect(kayitliHata(new AdimHatasi("4/6 Dış ses", "Azure hatası (429)", "")).cozum).toContain("kullanım sınırı");
    expect(kayitliHata(new AdimHatasi("3/6 Senaryo", "Sahne 2: rakam var", "")).cozum).toContain("elle düzenleyin");
  });
});
