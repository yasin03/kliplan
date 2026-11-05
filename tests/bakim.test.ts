import { mkdir, mkdtemp, readdir, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { CreateBucketCommand } from "@aws-sdk/client-s3";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Veritabani } from "../src/db/baglanti.js";
import { account, ilan, muzik, ofis, session, user, video } from "../src/db/sema.js";
import { s3Istemcisi } from "../src/depolama/S3Depolama.js";
import { eskiYedekleriSil, yedekIndir, yedekleriListele, yedekYukle } from "../src/depolama/yedek.js";
import { YerelDepolama } from "../src/depolama/YerelDepolama.js";
import {
  BakimHatasi,
  kullaniciyiSil,
  ofisBul,
  ofisiSil,
  onbellekTemizle,
  saklamaAyarlari,
  suresiDolanOturumlariSil,
  temizlikPlani,
  temizlikUygula,
  VARSAYILAN_SAKLAMA,
} from "../src/veri/bakim.js";
import { depoOlustur } from "../src/veri/depo.js";
import type { Yetki } from "../src/veri/yetki.js";
import { tablolariBosalt, testKullanicisi, testVeritabani } from "./veritabani.js";

const testDb = await testVeritabani("bakim");
const GUN = 24 * 60 * 60 * 1000;

describe("saklama ayarları", () => {
  it("varsayılanları kullanıyor, geçersiz değeri reddediyor", () => {
    expect(saklamaAyarlari({})).toEqual(VARSAYILAN_SAKLAMA);
    expect(saklamaAyarlari({ SAKLAMA_ILAN_GUN: "180" }).ilanGun).toBe(180);
    expect(() => saklamaAyarlari({ SAKLAMA_ESKI_SURUM_GUN: "0" })).toThrow(BakimHatasi);
    expect(() => saklamaAyarlari({ SAKLAMA_ONBELLEK_GUN: "bir ay" })).toThrow("SAKLAMA_ONBELLEK_GUN");
  });
});

describe.skipIf(!testDb)("bakım: saklama süresi ve silme (veritabanı)", () => {
  const db = testDb as Veritabani;
  let depolama: YerelDepolama;
  let onbellek: string;
  let a: Yetki;
  let b: Yetki;

  beforeAll(async () => {
    depolama = new YerelDepolama(await mkdtemp(path.join(tmpdir(), "kliplan-bakim-")), "gizli");
  });

  beforeEach(async () => {
    await tablolariBosalt(db);
    onbellek = await mkdtemp(path.join(tmpdir(), "kliplan-bakim-onbellek-"));
    const [ofisA, ofisB] = await db.insert(ofis).values([{ ad: "Temurlar Grup" }, { ad: "Defne Emlak" }]).returning();
    a = { kullaniciId: "a", ofisId: ofisA!.id, admin: false };
    b = { kullaniciId: "b", ofisId: ofisB!.id, admin: false };
    await testKullanicisi(db, "a", a.ofisId);
    await testKullanicisi(db, "b", b.ofisId);
  });

  afterAll(async () => {
    await db.$client.end();
  });

  const depo = (y: Yetki) => depoOlustur(db, y, depolama);
  const eskit = (tablo: "ilan" | "video", id: string, gun: number) =>
    db.execute(sql`update ${sql.identifier(tablo)} set ${sql.identifier(tablo === "ilan" ? "guncelleme" : "olusturma")} = now() - ${`${gun} days`}::interval where id = ${id}`);

  async function videoEkle(y: Yetki, ilanId: string, surum: number, onayli = false) {
    const onek = `ofis/${y.ofisId}/ilan/${ilanId}/video/${surum}/`;
    await depolama.yaz(`${onek}video.mp4`, Buffer.from("v"), "video/mp4");
    const [v] = await db
      .insert(video)
      .values({
        ofisId: y.ofisId!,
        ilanId,
        surum,
        videoAnahtari: `${onek}video.mp4`,
        kapakAnahtari: `${onek}kapak.jpg`,
        raporAnahtari: `${onek}r.md`,
        senaryoAnahtari: `${onek}s.json`,
        sureSn: 1,
        boyutBayt: 1,
        maliyetUsd: 0,
        ...(onayli ? { onayZamani: new Date(), kontrolListesi: [] } : {}),
      })
      .returning();
    return v!;
  }

  it("süresi dolan ilanı dosyaları ve önbelleğiyle siliyor; yeni ilana ve üretimdekine dokunmuyor", async () => {
    const eski = await depo(a).ilanOlustur({ ilanNo: "1" });
    const yeni = await depo(a).ilanOlustur({ ilanNo: "2" });
    const uretimde = await depo(b).ilanOlustur({ ilanNo: "3" });
    await depo(b).ilanGuncelle(uretimde.id, { durum: "uretiliyor" });
    await videoEkle(a, eski.id, 1, true);
    await mkdir(path.join(onbellek, eski.id));
    await eskit("ilan", eski.id, 400);
    await eskit("ilan", uretimde.id, 400);

    const plan = await temizlikPlani(db, VARSAYILAN_SAKLAMA);
    expect(plan.ilanlar.map((i) => i.id)).toEqual([eski.id]);
    await temizlikUygula(db, depolama, plan, onbellek);
    expect((await db.select({ id: ilan.id }).from(ilan)).map((i) => i.id).sort()).toEqual([yeni.id, uretimde.id].sort());
    await expect(depolama.oku(`ofis/${a.ofisId}/ilan/${eski.id}/video/1/video.mp4`)).rejects.toThrow();
    expect(await readdir(onbellek)).toEqual([]);
  });

  it("yalnızca en son olmayan, onaysız ve süresi dolan video sürümlerini siliyor", async () => {
    const k = await depo(a).ilanOlustur({ ilanNo: "1" });
    const v1 = await videoEkle(a, k.id, 1);
    const v2 = await videoEkle(a, k.id, 2, true);
    const v3 = await videoEkle(a, k.id, 3);
    const v4 = await videoEkle(a, k.id, 4);
    for (const v of [v1, v2, v3, v4]) await eskit("video", v.id, 40);
    await eskit("video", v3.id, 10);

    const plan = await temizlikPlani(db, VARSAYILAN_SAKLAMA);
    expect(plan.eskiSurumler.map((v) => v.surum)).toEqual([1]);
    await temizlikUygula(db, depolama, plan, onbellek);
    expect((await depo(a).videolar(k.id)).map((v) => v.surum)).toEqual([4, 3, 2]);
    await expect(depolama.oku(v1.videoAnahtari)).rejects.toThrow();
    expect((await depolama.oku(v4.videoAnahtari)).toString()).toBe("v");
  });

  it("süresi dolan oturumları ve ilanı silinmiş/eski önbellek klasörlerini siliyor", async () => {
    await db.insert(session).values([
      { id: "s1", token: "t1", userId: "a", expiresAt: new Date(Date.now() - GUN) },
      { id: "s2", token: "t2", userId: "a", expiresAt: new Date(Date.now() + GUN) },
    ]);
    expect(await suresiDolanOturumlariSil(db)).toBe(1);
    expect((await db.select().from(session)).map((s) => s.id)).toEqual(["s2"]);

    const k = await depo(a).ilanOlustur({ ilanNo: "1" });
    const eskiK = await depo(a).ilanOlustur({ ilanNo: "2" });
    for (const ad of [k.id, eskiK.id, "silinmis-ilan"]) await mkdir(path.join(onbellek, ad));
    const eskiZaman = new Date(Date.now() - 40 * GUN);
    await utimes(path.join(onbellek, eskiK.id), eskiZaman, eskiZaman);
    expect((await onbellekTemizle(db, onbellek, 30)).sort()).toEqual([eskiK.id, "silinmis-ilan"].sort());
    expect(await readdir(onbellek)).toEqual([k.id]);
  });

  it("ofisi kullanıcıları, ilanları, müzikleri ve dosyalarıyla siliyor; diğer ofise dokunmuyor", async () => {
    await db.insert(account).values({ id: "h1", accountId: "a", providerId: "credential", userId: "a" });
    const k = await depo(a).ilanOlustur({ ilanNo: "1" });
    const kb = await depo(b).ilanOlustur({ ilanNo: "2" });
    await depo(a).fotografEkle(k.id, { dosyaAdi: "x.jpg", tur: "bina", icerik: Buffer.from("f"), icerikTuru: "image/jpeg", genislik: 1, yukseklik: 1 });
    await depo(b).fotografEkle(kb.id, { dosyaAdi: "y.jpg", tur: "bina", icerik: Buffer.from("f"), icerikTuru: "image/jpeg", genislik: 1, yukseklik: 1 });
    await depolama.yaz(`ofis/${a.ofisId}/logo/l.png`, Buffer.from("l"), "image/png");
    await db.insert(muzik).values({ ofisId: a.ofisId, ad: "m", anahtar: `ofis/${a.ofisId}/muzik/m.wav`, icerikTuru: "audio/wav", sureSn: 6, boyutBayt: 1, lisans: "x" });
    await mkdir(path.join(onbellek, k.id));

    const bulunan = await ofisBul(db, "Temurlar Grup");
    expect(bulunan).toMatchObject({ kullanicilar: ["a@test.local"], ilanlar: [{ id: k.id }] });
    await ofisiSil(db, depolama, a.ofisId!, onbellek);

    await expect(ofisBul(db, "Temurlar Grup")).rejects.toBeInstanceOf(BakimHatasi);
    expect(await db.query.user.findFirst({ where: eq(user.id, "a") })).toBeUndefined();
    expect(await db.select().from(account)).toEqual([]);
    expect(await db.select().from(muzik)).toEqual([]);
    await expect(depolama.oku(`ofis/${a.ofisId}/logo/l.png`)).rejects.toThrow();
    expect(await readdir(onbellek)).toEqual([]);
    expect(await depo(b).fotograflar(kb.id)).toHaveLength(1);
  });

  it("üretimi süren ilan varken ofis silinmiyor", async () => {
    const k = await depo(a).ilanOlustur({ ilanNo: "1" });
    await depo(a).ilanGuncelle(k.id, { durum: "uretiliyor" });
    await expect(ofisiSil(db, depolama, a.ofisId!, onbellek)).rejects.toThrow("üretimi süren");
    expect(await db.select().from(ofis)).toHaveLength(2);
  });

  it("kullanıcı silinince ilanı ofiste kalıyor, müzik beyanında adı kalıyor", async () => {
    const k = await depo(a).ilanOlustur({ ilanNo: "1" });
    await db.insert(muzik).values({ ofisId: a.ofisId, ad: "m", anahtar: "ofis/x/muzik/m.wav", icerikTuru: "audio/wav", sureSn: 6, boyutBayt: 1, lisans: "x", beyan: "b", beyanEdenId: "a", beyanEdenAd: "Ayşe" });
    await kullaniciyiSil(db, "A@test.local ");
    expect(await db.query.ilan.findFirst({ where: eq(ilan.id, k.id) })).toMatchObject({ olusturanId: null });
    expect(await db.query.muzik.findFirst()).toMatchObject({ beyanEdenId: null, beyanEdenAd: "Ayşe" });
    await expect(kullaniciyiSil(db, "yok@test.local")).rejects.toBeInstanceOf(BakimHatasi);
  });
});

const s3 = process.env.TEST_S3_ENDPOINT;

describe.skipIf(!s3)("veritabanı yedekleri (gerçek S3 sunucusu)", () => {
  const ayarlar = { endpoint: s3!, bucket: `kliplan-yedek-test-${Date.now()}`, erisimAnahtari: "test", gizliAnahtar: "test", bolge: "us-east-1", yolBicimi: true };
  const istemci = s3Istemcisi(ayarlar);

  beforeAll(async () => {
    await istemci.send(new CreateBucketCommand({ Bucket: ayarlar.bucket }));
  });

  it("yüklüyor, listeliyor, indiriyor; eskileri siliyor ama en yeni üçü kalıyor", async () => {
    const klasor = await mkdtemp(path.join(tmpdir(), "kliplan-yedek-"));
    for (const ad of ["kliplan-1.dump", "kliplan-2.dump", "kliplan-3.dump", "kliplan-4.dump"]) {
      await writeFile(path.join(klasor, ad), ad);
      await yedekYukle(istemci, ayarlar.bucket, path.join(klasor, ad));
    }
    expect(await yedekleriListele(istemci, ayarlar.bucket)).toHaveLength(4);
    await yedekIndir(istemci, ayarlar.bucket, "postgres/kliplan-2.dump", path.join(klasor, "geri.dump"));
    await expect((await import("node:fs/promises")).readFile(path.join(klasor, "geri.dump"), "utf8")).resolves.toBe("kliplan-2.dump");

    // Hepsi "eski" sayılsa da en yeni üçü kalır.
    expect(await eskiYedekleriSil(istemci, ayarlar.bucket, 30, new Date(Date.now() + 60 * GUN))).toHaveLength(1);
    expect(await eskiYedekleriSil(istemci, ayarlar.bucket, 30)).toEqual([]);
    expect(await yedekleriListele(istemci, ayarlar.bucket)).toHaveLength(3);
  });
});
