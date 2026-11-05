import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Veritabani } from "../src/db/baglanti.js";
import { ofis } from "../src/db/sema.js";
import { YerelDepolama } from "../src/depolama/YerelDepolama.js";
import type { videoyuRenderEt } from "../src/pipeline/render.js";
import type { VideoProps } from "../src/remotion/tipler.js";
import { MockScriptProvider } from "../src/providers/MockScriptProvider.js";
import { MockTtsProvider } from "../src/providers/MockTtsProvider.js";
import { depoOlustur, DuzenlemeHatasi } from "../src/veri/depo.js";
import { MUZIK_BEYANI } from "../src/veri/gorunum.js";
import { logoyuIsle, muzigiIsle } from "../src/veri/gorunumIsleme.js";
import { ilanFormunuDogrula, veriyiFormaCevir } from "../src/veri/ilanFormu.js";
import { BulunamadiHatasi, dosyayaErisebilirMi, ErisimHatasi, type Yetki } from "../src/veri/yetki.js";
import { type IsBaglami, isiCalistir } from "../src/worker/isler.js";
import { tablolariBosalt, testKullanicisi, testVeritabani } from "./veritabani.js";
import { gercekFotografGibi, sessizWav, temurlarVerisi } from "./yardimci.js";

const testDb = await testVeritabani("gorunum");

describe.skipIf(!testDb)("ofis ayarları, logo ve müzik (veritabanı)", () => {
  const db = testDb as Veritabani;
  let depolama: YerelDepolama;
  let a: Yetki;
  let b: Yetki;
  const admin: Yetki = { kullaniciId: "admin", ofisId: null, admin: true };
  let wav: Awaited<ReturnType<typeof muzigiIsle>>;

  beforeAll(async () => {
    depolama = new YerelDepolama(await mkdtemp(path.join(tmpdir(), "kliplan-gorunum-")), "gizli");
    wav = await muzigiIsle(sessizWav(6));
  });

  beforeEach(async () => {
    await tablolariBosalt(db);
    const [ofisA, ofisB] = await db.insert(ofis).values([{ ad: "Temurlar Grup" }, { ad: "Defne Emlak" }]).returning();
    a = { kullaniciId: "a", ofisId: ofisA!.id, admin: false };
    b = { kullaniciId: "b", ofisId: ofisB!.id, admin: false };
    await testKullanicisi(db, "a", a.ofisId);
    await testKullanicisi(db, "b", b.ofisId);
    await testKullanicisi(db, "admin", null, "admin");
  });

  afterAll(async () => {
    await db.$client.end();
  });

  const depo = (yetki: Yetki) => depoOlustur(db, yetki, depolama);
  const yeniMuzik = (kutuphane: boolean, beyanOnayi = true) => ({ ad: "Sakin piyano", lisans: "Artlist, sipariş 42", kutuphane, beyanOnayi, dosya: { ...wav } });
  const ayarlar = { telefon: null, yetkiBelgeNo: null, vurguRengi: null, tema: "koyu" as const, varsayilanMuzikId: null };

  it("kütüphaneyi herkes görüyor; ofis yüklemesini yalnızca o ofis görüyor ve kullanabiliyor", async () => {
    const kutuphane = await depo(admin).muzikEkle(yeniMuzik(true));
    const muzikA = await depo(a).muzikEkle(yeniMuzik(false));
    expect(kutuphane.anahtar).toMatch(/^kutuphane\/muzik\/[0-9a-f]{8}\.wav$/);
    expect(muzikA.anahtar.startsWith(`ofis/${a.ofisId}/muzik/`)).toBe(true);
    expect(muzikA).toMatchObject({ beyan: MUZIK_BEYANI, beyanEdenId: "a", beyanEdenAd: "a" });

    expect((await depo(a).muzikler()).map((m) => m.id)).toEqual([kutuphane.id, muzikA.id]);
    expect((await depo(b).muzikler()).map((m) => m.id)).toEqual([kutuphane.id]);
    expect(await depo(admin).muzikler()).toHaveLength(2);

    await expect(depo(b).muzik(muzikA.id)).rejects.toBeInstanceOf(BulunamadiHatasi);
    await expect(depo(b).muzikBaglantisi(muzikA.id)).rejects.toBeInstanceOf(BulunamadiHatasi);
    await expect(depo(b).muzikSil(muzikA.id)).rejects.toBeInstanceOf(BulunamadiHatasi);
    await expect(depo(b).ofisAyarlariniKaydet({ ...ayarlar, varsayilanMuzikId: muzikA.id })).rejects.toBeInstanceOf(DuzenlemeHatasi);
    await depo(b).ofisAyarlariniKaydet({ ...ayarlar, varsayilanMuzikId: kutuphane.id });

    const ilanB = await depo(b).ilanOlustur({ ilanNo: "2" });
    await expect(depo(b).ilanGorunumunuKaydet(ilanB.id, { tema: null, muzikSecimi: "secili", muzikId: muzikA.id })).rejects.toBeInstanceOf(DuzenlemeHatasi);
    expect((await depo(b).ilanMuzigi(ilanB.id))?.id).toBe(kutuphane.id);

    // Kütüphane dosyası herkese, ofis dosyası yalnızca o ofise açılır.
    expect(dosyayaErisebilirMi(b, kutuphane.anahtar)).toBe(true);
    expect(dosyayaErisebilirMi(b, muzikA.anahtar)).toBe(false);
  });

  it("kütüphaneye yalnızca admin ekler ve siler; ofis yüklemesi beyan ister", async () => {
    await expect(depo(a).muzikEkle(yeniMuzik(true))).rejects.toBeInstanceOf(ErisimHatasi);
    await expect(depo(a).muzikEkle(yeniMuzik(false, false))).rejects.toThrow("beyanını onaylayın");
    await expect(depo(a).muzikEkle({ ...yeniMuzik(false), lisans: "  " })).rejects.toThrow("Lisans bilgisini");
    await expect(depo(admin).muzikEkle(yeniMuzik(false))).rejects.toBeInstanceOf(ErisimHatasi);
    const kutuphane = await depo(admin).muzikEkle(yeniMuzik(true));
    await expect(depo(a).muzikSil(kutuphane.id)).rejects.toBeInstanceOf(ErisimHatasi);
    await depo(admin).muzikSil(kutuphane.id);
    expect(await depo(a).muzikler()).toEqual([]);
  });

  it("silinen müzik: ofis varsayılanı müziksize, seçen ilan ofis varsayılanına dönüyor; dosya siliniyor", async () => {
    const m1 = await depo(a).muzikEkle(yeniMuzik(false));
    const m2 = await depo(a).muzikEkle({ ...yeniMuzik(false), ad: "İkinci" });
    await depo(a).ofisAyarlariniKaydet({ ...ayarlar, varsayilanMuzikId: m1.id });
    const ilanA = await depo(a).ilanOlustur({ ilanNo: "1" });
    await depo(a).ilanGorunumunuKaydet(ilanA.id, { tema: "sade", muzikSecimi: "secili", muzikId: m2.id });
    expect((await depo(a).ilanMuzigi(ilanA.id))?.id).toBe(m2.id);

    await depo(a).muzikSil(m2.id);
    expect((await depo(a).ilanMuzigi(ilanA.id))?.id).toBe(m1.id);
    await expect(depolama.oku(m2.anahtar)).rejects.toThrow();
    await depo(a).muzikSil(m1.id);
    expect(await depo(a).ilanMuzigi(ilanA.id)).toBeNull();
    expect((await depo(a).ayarlanacakOfis()).varsayilanMuzikId).toBeNull();
  });

  it("ofis ayarlarını üye yalnızca kendi ofisinde, admin seçtiği ofiste değiştiriyor; logo değişince eskisi siliniyor", async () => {
    await expect(depo(a).ayarlanacakOfis(b.ofisId!)).rejects.toBeInstanceOf(ErisimHatasi);
    await expect(depo(a).ofisAyarlariniKaydet(ayarlar, b.ofisId!)).rejects.toBeInstanceOf(ErisimHatasi);
    await expect(depo(admin).ofisAyarlariniKaydet(ayarlar)).rejects.toBeInstanceOf(ErisimHatasi);
    await depo(admin).ofisAyarlariniKaydet({ ...ayarlar, tema: "acik", vurguRengi: "#1E3A8A" }, b.ofisId!);
    expect(await depo(b).ayarlanacakOfis()).toMatchObject({ tema: "acik", vurguRengi: "#1E3A8A" });

    const logo = await logoyuIsle(await sharp({ create: { width: 400, height: 200, channels: 3, background: "#123456" } }).png().toBuffer());
    await depo(a).logoKaydet(logo);
    const ilk = (await depo(a).ayarlanacakOfis()).logoAnahtari!;
    expect(ilk.startsWith(`ofis/${a.ofisId}/logo/`)).toBe(true);
    await depo(a).logoKaydet({ ...logo, dosyaAdi: "yeni0001.png" });
    await expect(depolama.oku(ilk)).rejects.toThrow();
    await depo(a).logoSil();
    expect((await depo(a).ayarlanacakOfis()).logoAnahtari).toBeNull();
  });

  it("ilanın görünümü değişince ilan taslağa dönüyor, senaryo korunuyor; değişmezse dokunulmuyor", async () => {
    const ilanA = await depo(a).ilanOlustur({ ilanNo: "1" });
    await depo(a).ilanGuncelle(ilanA.id, { durum: "onaylandi", senaryo: { x: 1 } });
    await depo(a).ilanGorunumunuKaydet(ilanA.id, { tema: null, muzikSecimi: "ofis", muzikId: null });
    expect((await depo(a).ilan(ilanA.id)).durum).toBe("onaylandi");
    await depo(a).ilanGorunumunuKaydet(ilanA.id, { tema: "acik", muzikSecimi: "yok", muzikId: null });
    expect(await depo(a).ilan(ilanA.id)).toMatchObject({ durum: "taslak", senaryo: { x: 1 }, tema: "acik", muzikSecimi: "yok" });
    await expect(depo(b).ilanGorunumunuKaydet(ilanA.id, { tema: "sade", muzikSecimi: "yok", muzikId: null })).rejects.toBeInstanceOf(BulunamadiHatasi);
  });

  const resim = (ad = "r0000001.jpg") => ({ dosyaAdi: ad, icerik: Buffer.from("resim"), icerikTuru: "image/jpeg" as const, genislik: 1080, yukseklik: 1920 });

  it("şirket resmini yalnızca o şirket görüyor, siliyor ve ilanda seçebiliyor; en fazla 12 resim", async () => {
    const r = await depo(a).resimEkle(resim());
    expect(r.anahtar).toBe(`ofis/${a.ofisId}/resim/r0000001.jpg`);
    expect((await depo(a).resimler()).map((x) => x.id)).toEqual([r.id]);
    expect(await depo(b).resimler()).toEqual([]);
    await expect(depo(b).resimSil(r.id)).rejects.toBeInstanceOf(BulunamadiHatasi);
    await expect(depo(b).ofisAyarlariniKaydet({ varsayilanResimId: r.id })).rejects.toBeInstanceOf(DuzenlemeHatasi);
    const ilanB = await depo(b).ilanOlustur({ ilanNo: "2" });
    await expect(depo(b).ilanGorunumunuKaydet(ilanB.id, { tema: null, muzikSecimi: "ofis", muzikId: null, resimSecimi: "secili", resimId: r.id })).rejects.toBeInstanceOf(DuzenlemeHatasi);
    await expect(depo(b).ilanOlustur({ ilanNo: "3" }, undefined, { tema: null, muzikSecimi: "ofis", muzikId: null, resimSecimi: "secili", resimId: r.id })).rejects.toBeInstanceOf(DuzenlemeHatasi);
    expect(dosyayaErisebilirMi(b, r.anahtar)).toBe(false);

    for (let i = 2; i <= 12; i++) await depo(a).resimEkle(resim(`r${String(i).padStart(7, "0")}.jpg`));
    await expect(depo(a).resimEkle(resim("fazla001.jpg"))).rejects.toThrow("En fazla 12");
  });

  it("silinen resim: seçen ilan şirket varsayılanına, varsayılan seçen şirket ilan fotoğrafına dönüyor", async () => {
    const r1 = await depo(a).resimEkle(resim("r0000001.jpg"));
    const r2 = await depo(a).resimEkle(resim("r0000002.jpg"));
    await depo(a).ofisAyarlariniKaydet({ varsayilanResimId: r1.id });
    const k = await depo(a).ilanOlustur({ ilanNo: "1" }, undefined, { tema: "sade", muzikSecimi: "yok", muzikId: null, resimSecimi: "secili", resimId: r2.id });
    expect(k).toMatchObject({ tema: "sade", muzikSecimi: "yok", resimSecimi: "secili", resimId: r2.id });
    expect((await depo(a).ilanResmi(k.id))?.id).toBe(r2.id);
    await depo(a).resimSil(r2.id);
    expect((await depo(a).ilanResmi(k.id))?.id).toBe(r1.id);
    await expect(depolama.oku(r2.anahtar)).rejects.toThrow();
    await depo(a).resimSil(r1.id);
    expect(await depo(a).ilanResmi(k.id)).toBeNull();
    // Görünüm kaydında resim seçimi verilmezse mevcut korunur; seçili resim silindiyse şirket varsayılanına geçer.
    await depo(a).ilanGorunumunuKaydet(k.id, { tema: null, muzikSecimi: "ofis", muzikId: null });
    expect(await depo(a).ilan(k.id)).toMatchObject({ resimSecimi: "ofis", resimId: null });
    const r3 = await depo(a).resimEkle(resim("r0000003.jpg"));
    await depo(a).ilanGorunumunuKaydet(k.id, { tema: null, muzikSecimi: "ofis", muzikId: null, resimSecimi: "secili", resimId: r3.id });
    await depo(a).ilanGorunumunuKaydet(k.id, { tema: "acik", muzikSecimi: "ofis", muzikId: null });
    expect(await depo(a).ilan(k.id)).toMatchObject({ tema: "acik", resimSecimi: "secili", resimId: r3.id });
  });

  it("şirket adı değişince eski ad dönüyor; başka şirketin adı alınamıyor", async () => {
    expect(await depo(a).ofisAyarlariniKaydet({ ad: "Temurlar Grup" })).toEqual({ eskiAd: null });
    await expect(depo(a).ofisAyarlariniKaydet({ ad: "Defne Emlak" })).rejects.toThrow("başka bir şirket kayıtlı");
    expect(await depo(a).ofisAyarlariniKaydet({ ad: "Temurlar Gayrimenkul", web: "temurlar.com", kapanisAlanlari: ["web"] })).toEqual({ eskiAd: "Temurlar Grup" });
    expect(await depo(a).ayarlanacakOfis()).toMatchObject({ ad: "Temurlar Gayrimenkul", web: "temurlar.com", kapanisAlanlari: ["web"] });
  });

  it("aynı bilgiler yeniden kaydedilince senaryo korunuyor, değişince siliniyor", async () => {
    const veri = { ilanNo: "1", konum: { il: "A", ilce: "B", mahalle: "C", onayli: true } };
    const k = await depo(a).ilanOlustur(veri);
    await depo(a).ilanGuncelle(k.id, { senaryo: { x: 1 }, durum: "kontrol_bekliyor" });
    // Anahtar sırası farklı olsa da aynı bilgi.
    await depo(a).ilanBilgileriniKaydet(k.id, { konum: { onayli: true, mahalle: "C", ilce: "B", il: "A" }, ilanNo: "1" });
    expect(await depo(a).ilan(k.id)).toMatchObject({ senaryo: { x: 1 }, durum: "kontrol_bekliyor" });
    await depo(a).ilanBilgileriniKaydet(k.id, { ...veri, ilanNo: "2" });
    expect(await depo(a).ilan(k.id)).toMatchObject({ senaryo: null, durum: "taslak" });
  });

  describe("worker", () => {
    let alinanProps: VideoProps | undefined;
    let publicKlasoru = "";
    const sahteRender = async (g: Parameters<typeof videoyuRenderEt>[0]) => {
      alinanProps = g.props;
      publicKlasoru = g.publicKlasoru;
      await writeFile(g.videoYolu, "video");
      for (const k of g.kareler ?? []) await writeFile(k.yol, "kapak");
      return { kareSayisi: 900, fps: 30, sureSn: 30 };
    };

    async function baglam(): Promise<IsBaglami> {
      return {
        db,
        depolama,
        senaryoSaglayici: new MockScriptProvider(),
        sesSaglayici: new MockTtsProvider(),
        onbellekKoku: await mkdtemp(path.join(tmpdir(), "kliplan-gorunum-onbellek-")),
        test: true,
        renderEt: sahteRender,
      };
    }

    async function hazirIlan() {
      const sonuc = ilanFormunuDogrula(veriyiFormaCevir(temurlarVerisi()));
      if (!sonuc.basarili) throw new Error(JSON.stringify(sonuc.hatalar));
      const kayit = await depo(a).ilanOlustur(sonuc.veri);
      const foto = await gercekFotografGibi();
      for (const [i, tur] of ["bina", "salon", "mutfak", "yatak_odasi", "koridor"].entries()) {
        await depo(a).fotografEkle(kayit.id, { dosyaAdi: `${i}.jpg`, tur, icerik: foto, icerikTuru: "image/jpeg", genislik: 1600, yukseklik: 1200 });
      }
      return kayit;
    }

    it("video işi ofisin logosunu, vurgu rengini, ilanın temasını ve müziğini kullanıyor; rapora lisans ve beyan yazılıyor", async () => {
      const b1 = await baglam();
      const m = await depo(a).muzikEkle(yeniMuzik(false));
      await depo(a).ofisAyarlariniKaydet({ ...ayarlar, vurguRengi: "#1E3A8A", tema: "acik", varsayilanMuzikId: m.id });
      await depo(a).logoKaydet(await logoyuIsle(await sharp({ create: { width: 400, height: 200, channels: 3, background: "#123456" } }).png().toBuffer()));
      const kayit = await hazirIlan();

      await isiCalistir(b1, (await depo(a).uretimBaslat(kayit.id, "senaryo")).id);
      await isiCalistir(b1, (await depo(a).uretimBaslat(kayit.id, "video")).id);

      expect(alinanProps).toMatchObject({ tema: "acik", vurguRengi: "#1E3A8A", ofis: { logo: "ilan/logo.png" }, muzik: "ilan/muzik.wav" });
      expect((await sharp(path.join(publicKlasoru, "ilan/logo.png")).metadata()).width).toBe(400);
      const [v] = await depo(a).videolar(kayit.id);
      const rapor = (await depolama.oku(v!.raporAnahtari)).toString();
      expect(rapor).toContain("- Tema: Açık · Vurgu rengi: #1E3A8A · Logo: var");
      expect(rapor).toContain("- Ticari kullanım izni: Artlist, sipariş 42");
      expect(rapor).toContain(`- Beyan: a, `);
      expect(rapor).toContain(MUZIK_BEYANI);
    });

    it("seçilen şirket resmi kapanış arka planı oluyor, seçilen şirket bilgileri kapanış kartına ve rapora yazılıyor", async () => {
      const b1 = await baglam();
      const foto = await sharp({ create: { width: 1080, height: 1920, channels: 3, background: "#336699" } }).jpeg().toBuffer();
      const r = await depo(a).resimEkle({ dosyaAdi: "ofisici1.jpg", icerik: foto, icerikTuru: "image/jpeg", genislik: 1080, yukseklik: 1920 });
      await depo(a).ofisAyarlariniKaydet({ web: "temurlargrup.com", yetkiliAdi: "Ayşe", yetkiliSoyadi: "Yılmaz", eposta: "bilgi@temurlar.com", kapanisAlanlari: ["web", "yetkili"], varsayilanResimId: r.id });
      const kayit = await hazirIlan();
      await isiCalistir(b1, (await depo(a).uretimBaslat(kayit.id, "senaryo")).id);
      await isiCalistir(b1, (await depo(a).uretimBaslat(kayit.id, "video")).id);

      expect(alinanProps?.kapanisFotografi).toMatchObject({ src: "ilan/_kapanis.jpg", genislik: 1080, yukseklik: 1920 });
      expect(alinanProps?.iletisim.ekSatirlar).toEqual(["temurlargrup.com", "Ayşe Yılmaz"]);
      const rapor = (await depolama.oku((await depo(a).videolar(kayit.id))[0]!.raporAnahtari)).toString();
      expect(rapor).toContain("| Web | temurlargrup.com | `sirketBilgileri.web` | kapanış kartı |");
      expect(rapor).toContain("- Kapanış arka planı: şirket resmi");
      expect(rapor).not.toContain("bilgi@temurlar.com");

      // İlanda "ilan fotoğrafı" seçilince şirket resmi kullanılmaz.
      await depo(a).ilanGorunumunuKaydet(kayit.id, { tema: null, muzikSecimi: "ofis", muzikId: null, resimSecimi: "yok", resimId: null });
      await isiCalistir(b1, (await depo(a).uretimBaslat(kayit.id, "video")).id);
      expect(alinanProps?.kapanisFotografi).toBeNull();
    });

    it("ilanda müziksiz seçilince müzik eklenmiyor; vurgu rengi seçilen temada okunmuyorsa üretim 1. adımda duruyor", async () => {
      const b1 = await baglam();
      const m = await depo(a).muzikEkle(yeniMuzik(false));
      await depo(a).ofisAyarlariniKaydet({ ...ayarlar, vurguRengi: "#F2A541", varsayilanMuzikId: m.id });
      const kayit = await hazirIlan();
      await depo(a).ilanGorunumunuKaydet(kayit.id, { tema: null, muzikSecimi: "yok", muzikId: null });
      await isiCalistir(b1, (await depo(a).uretimBaslat(kayit.id, "senaryo")).id);
      await isiCalistir(b1, (await depo(a).uretimBaslat(kayit.id, "video")).id);
      expect(alinanProps?.muzik).toBeNull();
      expect(alinanProps?.tema).toBe("koyu");

      await depo(a).ilanGorunumunuKaydet(kayit.id, { tema: "acik", muzikSecimi: "yok", muzikId: null });
      const is = await depo(a).uretimBaslat(kayit.id, "video");
      await expect(isiCalistir(b1, is.id)).rejects.toThrow();
      expect((await depo(a).ilan(kayit.id)).hata).toMatchObject({ adim: "1/6 Doğrulama", mesaj: expect.stringContaining("açık temada okunmuyor") });
    });
  });
});
