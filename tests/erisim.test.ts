import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Veritabani } from "../src/db/baglanti.js";
import { ofis } from "../src/db/sema.js";
import { YerelDepolama } from "../src/depolama/YerelDepolama.js";
import { depoOlustur, DuzenlemeHatasi } from "../src/veri/depo.js";
import { BulunamadiHatasi, ErisimHatasi, type Yetki } from "../src/veri/yetki.js";
import { tablolariBosalt, testKullanicisi, testVeritabani } from "./veritabani.js";

const testDb = await testVeritabani("erisim");

describe.skipIf(!testDb)("müşteri ayrımı (veritabanı)", () => {
  const db = testDb as Veritabani;
  let depolama: YerelDepolama;
  let a: Yetki;
  let b: Yetki;
  const admin: Yetki = { kullaniciId: "admin", ofisId: null, admin: true };
  const foto = { dosyaAdi: "01-bina.jpg", tur: "bina", icerik: Buffer.from("foto"), icerikTuru: "image/jpeg", genislik: 1920, yukseklik: 1080 };

  beforeAll(async () => {
    depolama = new YerelDepolama(await mkdtemp(path.join(tmpdir(), "kliplan-erisim-")), "gizli");
  });

  beforeEach(async () => {
    await tablolariBosalt(db);
    const [ofisA, ofisB] = await db
      .insert(ofis)
      .values([{ ad: "Temurlar Grup" }, { ad: "Defne Emlak" }])
      .returning();
    a = { kullaniciId: "a", ofisId: ofisA!.id, admin: false };
    b = { kullaniciId: "b", ofisId: ofisB!.id, admin: false };
    await testKullanicisi(db, "a", a.ofisId);
    await testKullanicisi(db, "b", b.ofisId);
    await testKullanicisi(db, "admin", null, "admin");
    await testKullanicisi(db, "c", null);
  });

  afterAll(async () => {
    await db.$client.end();
  });

  const depo = (yetki: Yetki) => depoOlustur(db, yetki, depolama);

  it("her ofis yalnızca kendi ilanlarını listeliyor; admin hepsini görüyor", async () => {
    await depo(a).ilanOlustur({ ilanNo: "1" });
    await depo(b).ilanOlustur({ ilanNo: "2" });
    expect((await depo(a).ilanlar()).map((i) => i.veri.ilanNo)).toEqual(["1"]);
    expect((await depo(b).ilanlar()).map((i) => i.veri.ilanNo)).toEqual(["2"]);
    expect(await depo(admin).ilanlar()).toHaveLength(2);
  });

  it("başka ofisin ilanını okuyamıyor, güncelleyemiyor, silemiyor", async () => {
    const ilanB = await depo(b).ilanOlustur({ ilanNo: "2" });
    await expect(depo(a).ilan(ilanB.id)).rejects.toBeInstanceOf(BulunamadiHatasi);
    await expect(depo(a).ilanGuncelle(ilanB.id, { durum: "onaylandi" })).rejects.toBeInstanceOf(BulunamadiHatasi);
    await expect(depo(a).ilanSil(ilanB.id)).rejects.toBeInstanceOf(BulunamadiHatasi);
    expect((await depo(b).ilan(ilanB.id)).durum).toBe("taslak");
  });

  it("başka ofisin ilanına fotoğraf ekleyemiyor, fotoğraflarını ve videolarını göremiyor", async () => {
    const ilanB = await depo(b).ilanOlustur({ ilanNo: "2" });
    await depo(b).fotografEkle(ilanB.id, foto);
    await expect(depo(a).fotografEkle(ilanB.id, foto)).rejects.toBeInstanceOf(BulunamadiHatasi);
    await expect(depo(a).fotograflar(ilanB.id)).rejects.toBeInstanceOf(BulunamadiHatasi);
    await expect(depo(a).videolar(ilanB.id)).rejects.toBeInstanceOf(BulunamadiHatasi);
    expect(await depo(b).fotograflar(ilanB.id)).toHaveLength(1);
  });

  it("başka ofisin dosyası için bağlantı üretmiyor", async () => {
    const ilanB = await depo(b).ilanOlustur({ ilanNo: "2" });
    const { anahtar } = await depo(b).fotografEkle(ilanB.id, foto);
    expect(anahtar).toBe(`ofis/${b.ofisId}/ilan/${ilanB.id}/fotograf/01-bina.jpg`);
    await expect(depo(b).dosyaBaglantisi(anahtar)).resolves.toContain(`/dosya/${anahtar}?`);
    await expect(depo(a).dosyaBaglantisi(anahtar)).rejects.toBeInstanceOf(ErisimHatasi);
    // Önek oyunu: kendi ofis önekiyle başlayıp başka ofise çıkmaya çalışmak.
    await expect(depo(a).dosyaBaglantisi(`ofis/${a.ofisId}/../${b.ofisId}/ilan/x/y.jpg`)).rejects.toThrow("Geçersiz dosya anahtarı");
    await expect(depo(admin).dosyaBaglantisi(anahtar)).resolves.toContain("/dosya/");
  });

  it("başka ofis adına ilan oluşturamıyor; ofissiz üye hiçbir şey göremiyor", async () => {
    await expect(depo(a).ilanOlustur({}, b.ofisId!)).rejects.toBeInstanceOf(ErisimHatasi);
    await expect(depo(admin).ilanOlustur({})).rejects.toThrow("ofis seçilmeli");
    expect((await depo(admin).ilanOlustur({ ilanNo: "3" }, b.ofisId!)).ofisId).toBe(b.ofisId);

    const ofissiz: Yetki = { kullaniciId: "c", ofisId: null, admin: false };
    await expect(depo(ofissiz).ilanlar()).rejects.toBeInstanceOf(ErisimHatasi);
    await expect(depo(ofissiz).ilanOlustur({})).rejects.toBeInstanceOf(ErisimHatasi);
  });

  it("ilan silinince fotoğraf kayıtları ve depodaki dosyaları da siliniyor", async () => {
    const ilanA = await depo(a).ilanOlustur({ ilanNo: "1" });
    const { anahtar } = await depo(a).fotografEkle(ilanA.id, foto);
    await depo(a).ilanSil(ilanA.id);
    await expect(depo(a).ilan(ilanA.id)).rejects.toBeInstanceOf(BulunamadiHatasi);
    expect(await db.query.fotograf.findMany()).toHaveLength(0);
    await expect(depolama.oku(anahtar)).rejects.toThrow("Dosya bulunamadı");
  });

  it("başka ofisin fotoğrafının türünü değiştiremiyor, silemiyor, sırasını değiştiremiyor", async () => {
    const ilanB = await depo(b).ilanOlustur({ ilanNo: "2" });
    const f1 = await depo(b).fotografEkle(ilanB.id, foto);
    const f2 = await depo(b).fotografEkle(ilanB.id, { ...foto, dosyaAdi: "02-salon.jpg" });
    await expect(depo(a).fotografTuruDegistir(f1.id, "salon")).rejects.toBeInstanceOf(BulunamadiHatasi);
    await expect(depo(a).fotografSil(f1.id)).rejects.toBeInstanceOf(BulunamadiHatasi);
    await expect(depo(a).fotograflariSirala(ilanB.id, [f2.id, f1.id])).rejects.toBeInstanceOf(BulunamadiHatasi);
    await expect(depo(a).ilanBilgileriniKaydet(ilanB.id, { ilanNo: "9" })).rejects.toBeInstanceOf(BulunamadiHatasi);
    await expect(depo(a).ilanOfisi(ilanB.id)).rejects.toBeInstanceOf(BulunamadiHatasi);
    expect((await depo(b).fotograflar(ilanB.id)).map((f) => [f.dosyaAdi, f.tur])).toEqual([
      ["01-bina.jpg", "bina"],
      ["02-salon.jpg", "bina"],
    ]);
    await expect(depolama.oku(f1.anahtar)).resolves.toBeDefined();
  });

  it("admin yalnızca ofis listesini görüyor; üye yalnızca kendi ofisini", async () => {
    expect((await depo(admin).ofisler()).map((o) => o.ad)).toEqual(["Defne Emlak", "Temurlar Grup"]);
    expect((await depo(a).ofisler()).map((o) => o.id)).toEqual([a.ofisId]);
  });

  it("fotoğrafları sıralıyor, siliyor; eksik veya yabancı kimlikli sıralamayı reddediyor", async () => {
    const ilanA = await depo(a).ilanOlustur({ ilanNo: "1" });
    const [f1, f2, f3] = [
      await depo(a).fotografEkle(ilanA.id, foto),
      await depo(a).fotografEkle(ilanA.id, { ...foto, dosyaAdi: "02.jpg" }),
      await depo(a).fotografEkle(ilanA.id, { ...foto, dosyaAdi: "03.jpg" }),
    ];
    await depo(a).fotograflariSirala(ilanA.id, [f3!.id, f1!.id, f2!.id]);
    expect((await depo(a).fotograflar(ilanA.id)).map((f) => f.dosyaAdi)).toEqual(["03.jpg", "01-bina.jpg", "02.jpg"]);

    await expect(depo(a).fotograflariSirala(ilanA.id, [f3!.id, f1!.id])).rejects.toBeInstanceOf(DuzenlemeHatasi);
    await expect(depo(a).fotograflariSirala(ilanA.id, [f3!.id, f1!.id, f1!.id])).rejects.toBeInstanceOf(DuzenlemeHatasi);

    const ilanB = await depo(b).ilanOlustur({ ilanNo: "2" });
    const yabanci = await depo(b).fotografEkle(ilanB.id, foto);
    await expect(depo(a).fotograflariSirala(ilanA.id, [f3!.id, f1!.id, yabanci.id])).rejects.toBeInstanceOf(DuzenlemeHatasi);

    await depo(a).fotografSil(f1!.id);
    await expect(depolama.oku(f1!.anahtar)).rejects.toThrow("Dosya bulunamadı");
    // Silinenden sonra eklenen fotoğraf sona gelmeli.
    await depo(a).fotografEkle(ilanA.id, { ...foto, dosyaAdi: "04.jpg" });
    expect((await depo(a).fotograflar(ilanA.id)).map((f) => f.dosyaAdi)).toEqual(["03.jpg", "02.jpg", "04.jpg"]);
  });

  it("üretim sürerken ilan değiştirilemiyor; değişiklik ilanı taslağa döndürüp senaryoyu siliyor", async () => {
    const ilanA = await depo(a).ilanOlustur({ ilanNo: "1" });
    const f1 = await depo(a).fotografEkle(ilanA.id, foto);

    await depo(a).ilanGuncelle(ilanA.id, { durum: "uretiliyor" });
    await expect(depo(a).ilanBilgileriniKaydet(ilanA.id, { ilanNo: "2" })).rejects.toBeInstanceOf(DuzenlemeHatasi);
    await expect(depo(a).fotografEkle(ilanA.id, { ...foto, dosyaAdi: "02.jpg" })).rejects.toBeInstanceOf(DuzenlemeHatasi);
    await expect(depo(a).fotografSil(f1.id)).rejects.toBeInstanceOf(DuzenlemeHatasi);

    await depo(a).ilanGuncelle(ilanA.id, { durum: "kontrol_bekliyor", senaryo: { sahneler: [] } });
    await depo(a).fotografTuruDegistir(f1.id, "salon");
    expect((await depo(a).ilan(ilanA.id)).durum).toBe("taslak");

    await depo(a).ilanGuncelle(ilanA.id, { durum: "hata", hata: { adim: "render", mesaj: "x", cozum: "y" } });
    const kayit = await depo(a).ilanBilgileriniKaydet(ilanA.id, { ilanNo: "2" });
    expect(kayit).toMatchObject({ durum: "taslak", hata: null, senaryo: null, veri: { ilanNo: "2" } });
  });

  it("bir ilana en fazla 20 fotoğraf eklenebiliyor", async () => {
    const ilanA = await depo(a).ilanOlustur({ ilanNo: "1" });
    for (let i = 0; i < 20; i++) await depo(a).fotografEkle(ilanA.id, { ...foto, dosyaAdi: `${i}.jpg` });
    await expect(depo(a).fotografEkle(ilanA.id, { ...foto, dosyaAdi: "fazla.jpg" })).rejects.toThrow("en fazla 20");
    await expect(depolama.oku(`ofis/${a.ofisId}/ilan/${ilanA.id}/fotograf/fazla.jpg`)).rejects.toThrow("Dosya bulunamadı");
  });
});
