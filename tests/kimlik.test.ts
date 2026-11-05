import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Veritabani } from "../src/db/baglanti.js";
import { kimlikOlustur } from "../src/kimlik/auth.js";
import { KullaniciHatasi, kullaniciEkle, rastgeleSifre } from "../src/kimlik/kullanici.js";
import { tablolariBosalt, testVeritabani } from "./veritabani.js";

const testDb = await testVeritabani("kimlik");

describe.skipIf(!testDb)("giriş ve hesap açma (veritabanı)", () => {
  const db = testDb as Veritabani;
  let kimlik: ReturnType<typeof kimlikOlustur>;

  beforeAll(() => {
    kimlik = kimlikOlustur(db);
  });

  beforeEach(() => tablolariBosalt(db));

  afterAll(async () => {
    await db.$client.end();
  });

  it("ofisle birlikte hesap açıyor ve verilen şifreyle giriş yapılabiliyor", async () => {
    const sonuc = await kullaniciEkle(db, kimlik, {
      eposta: "Ali@Ornek.com ",
      ad: "Ali Veli",
      ofisAdi: "Temurlar Grup",
      sifre: "guclu-sifre-123",
    });
    expect(sonuc.eposta).toBe("ali@ornek.com");
    expect(sonuc.ofisId).toBeTruthy();

    const giris = await kimlik.api.signInEmail({ body: { email: "ali@ornek.com", password: "guclu-sifre-123" } });
    expect(giris.user.email).toBe("ali@ornek.com");
    const kullanici = await db.query.user.findFirst();
    expect(kullanici).toMatchObject({ rol: "uye", ofisId: sonuc.ofisId });
  });

  it("aynı ofis adına ikinci kullanıcıyı aynı ofise bağlıyor", async () => {
    const a = await kullaniciEkle(db, kimlik, { eposta: "a@ornek.com", ad: "A", ofisAdi: "Defne Emlak" });
    const b = await kullaniciEkle(db, kimlik, { eposta: "b@ornek.com", ad: "B", ofisAdi: "Defne Emlak" });
    expect(b.ofisId).toBe(a.ofisId);
    expect(await db.query.ofis.findMany()).toHaveLength(1);
  });

  it("yanlış şifreyi reddediyor", async () => {
    await kullaniciEkle(db, kimlik, { eposta: "ali@ornek.com", ad: "Ali", ofisAdi: "Temurlar Grup", sifre: "guclu-sifre-123" });
    await expect(kimlik.api.signInEmail({ body: { email: "ali@ornek.com", password: "yanlis-sifre-000" } })).rejects.toThrow(
      /Invalid email or password/,
    );
  });

  it("açık kayıt kapalı", async () => {
    await expect(kimlik.api.signUpEmail({ body: { email: "yabanci@ornek.com", password: "bir-sifre-12345", name: "X" } })).rejects.toThrow(
      /not enabled/,
    );
    expect(await db.query.user.findMany()).toHaveLength(0);
  });

  it("aynı e-postayı, kısa şifreyi ve ofissiz üye hesabını reddediyor", async () => {
    await kullaniciEkle(db, kimlik, { eposta: "ali@ornek.com", ad: "Ali", ofisAdi: "Temurlar Grup" });
    await expect(kullaniciEkle(db, kimlik, { eposta: "ALI@ornek.com", ad: "Ali", ofisAdi: "Temurlar Grup" })).rejects.toThrow("zaten var");
    await expect(kullaniciEkle(db, kimlik, { eposta: "k@ornek.com", ad: "K", ofisAdi: "X", sifre: "kisa" })).rejects.toThrow(
      "en az 10 karakter",
    );
    await expect(kullaniciEkle(db, kimlik, { eposta: "o@ornek.com", ad: "O" })).rejects.toBeInstanceOf(KullaniciHatasi);
  });

  it("admin hesabını ofissiz açıyor", async () => {
    const sonuc = await kullaniciEkle(db, kimlik, { eposta: "admin@ornek.com", ad: "Yönetici", admin: true });
    expect(sonuc.ofisId).toBeNull();
    expect(sonuc.sifreUretildi).toBe(true);
    expect(sonuc.sifre).toHaveLength(14);
    expect(await db.query.user.findFirst()).toMatchObject({ rol: "admin", ofisId: null });
  });
});

describe("rastgele şifre", () => {
  it("karışabilecek karakterleri içermiyor", () => {
    for (let i = 0; i < 50; i++) expect(rastgeleSifre()).toMatch(/^[a-km-zA-HJ-NP-Z2-9]{14}$/);
  });
});
