import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { gorunumAlanlari, ilanMuzikId, ilanResimId, type MuzikKaydi, muzikIzni, ofisAyarFormunuDogrula, sirketBilgileri } from "../src/veri/gorunum.js";
import { GorunumDosyasiHatasi, logoyuIsle, muzigiIsle } from "../src/veri/gorunumIsleme.js";
import { ilanJsonuOlustur } from "../src/veri/ilanFormu.js";
import { sessizWav, temurlarVerisi } from "./yardimci.js";

const saydamLogo = (renk: string) =>
  sharp({ create: { width: 600, height: 200, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: { create: { width: 400, height: 120, channels: 4, background: renk } }, left: 100, top: 40 }])
    .png()
    .toBuffer();

const muzikKaydi = (degisiklik: Partial<MuzikKaydi> = {}): MuzikKaydi => ({
  id: "m1",
  ofisId: null,
  ad: "Sakin piyano",
  anahtar: "kutuphane/muzik/abc.mp3",
  icerikTuru: "audio/mpeg",
  sureSn: 60,
  boyutBayt: 1,
  lisans: "Artlist kurumsal lisans",
  beyan: null,
  beyanEdenId: null,
  beyanEdenAd: null,
  olusturma: new Date("2026-11-05T10:00:00Z"),
  guncelleme: new Date("2026-11-05T10:00:00Z"),
  ...degisiklik,
});

describe("logo işleme", () => {
  it("saydamlığı koruyarak PNG'ye çeviriyor, üst verileri siliyor, büyük logoyu küçültüyor", async () => {
    const girdi = await sharp({ create: { width: 3000, height: 1000, channels: 4, background: { r: 30, g: 58, b: 138, alpha: 0.5 } } })
      .withExif({ IFD0: { Artist: "Gizli Kişi" } })
      .webp()
      .toBuffer();
    const logo = await logoyuIsle(girdi);
    const meta = await sharp(logo.icerik).metadata();
    expect(meta).toMatchObject({ format: "png", width: 1200, height: 400, hasAlpha: true });
    expect(meta.exif).toBeUndefined();
    expect(logo.dosyaAdi).toMatch(/^[0-9a-f]{8}\.png$/);
  });

  it("beyaz saydam logoda açık tema, siyahta koyu tema uyarısı veriyor; zeminli logoda uyarı yok", async () => {
    expect((await logoyuIsle(await saydamLogo("#FFFFFF"))).uyarilar.join()).toContain("açık temada");
    expect((await logoyuIsle(await saydamLogo("#000000"))).uyarilar.join()).toContain("koyu ve sade temalarda");
    const zeminli = await sharp({ create: { width: 600, height: 200, channels: 3, background: "#FFFFFF" } }).png().toBuffer();
    expect((await logoyuIsle(zeminli)).uyarilar).toEqual([]);
  });

  it("SVG'yi ve görsel olmayan dosyayı reddediyor", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script></svg>');
    await expect(logoyuIsle(svg)).rejects.toThrow("SVG");
    await expect(logoyuIsle(Buffer.from("logo değil"))).rejects.toBeInstanceOf(GorunumDosyasiHatasi);
  });
});

describe("müzik işleme", () => {
  it("WAV dosyasını tanıyor ve süresini ölçüyor; dosya adı rastgele", async () => {
    const m = await muzigiIsle(sessizWav(6));
    expect(m).toMatchObject({ icerikTuru: "audio/wav", sureSn: 6 });
    expect(m.dosyaAdi).toMatch(/^[0-9a-f]{8}\.wav$/);
  });

  it("ses olmayan, çok kısa dosyayı reddediyor", async () => {
    const jpeg = await sharp({ create: { width: 10, height: 10, channels: 3, background: "#000" } }).jpeg().toBuffer();
    await expect(muzigiIsle(jpeg)).rejects.toThrow("MP3, M4A veya WAV");
    await expect(muzigiIsle(sessizWav(2))).rejects.toThrow("en az 5 saniye");
  });
});

describe("görünüm çözümü", () => {
  const ofis = { tema: "koyu", vurguRengi: null, logoAnahtari: null, varsayilanMuzikId: "varsayilan" };

  it("ilanın müzik seçimi: ofis varsayılanı, müziksiz, seçili (silinmişse varsayılan)", () => {
    expect(ilanMuzikId(ofis, { muzikSecimi: "ofis", muzikId: null })).toBe("varsayilan");
    expect(ilanMuzikId(ofis, { muzikSecimi: "yok", muzikId: null })).toBeNull();
    expect(ilanMuzikId(ofis, { muzikSecimi: "secili", muzikId: "m2" })).toBe("m2");
    expect(ilanMuzikId(ofis, { muzikSecimi: "secili", muzikId: null })).toBe("varsayilan");
  });

  it("ilan.json alanları: ilan teması ofisinkini geçersiz kılıyor; logo ve müzik dosya adları", () => {
    const alanlar = gorunumAlanlari({ ...ofis, tema: "sade", vurguRengi: "#2BB673", logoAnahtari: "ofis/x/logo/ab12cd34.png" }, { tema: "acik" }, muzikKaydi());
    expect(alanlar).toEqual({
      tema: "acik",
      vurguRengi: "#2BB673",
      logo: "logo.png",
      muzik: { dosya: "muzik.mp3", lisans: "Kliplan müzik kütüphanesi: Artlist kurumsal lisans" },
    });
    expect(gorunumAlanlari({ ...ofis, tema: "sade" }, { tema: null }, null)).toEqual({ tema: "sade" });
  });

  it("ofis yüklemesinde beyan eden, zaman ve beyan metni izne ekleniyor", () => {
    const izin = muzikIzni(muzikKaydi({ ofisId: "o1", lisans: "Kendi bestem", beyan: "Beyan ederim.", beyanEdenAd: "Ayşe Yılmaz" }));
    expect(izin.lisans).toBe("Kendi bestem");
    expect(izin.beyan).toMatch(/^Ayşe Yılmaz, 5 Kasım 2026 13:00: "Beyan ederim\."$/);
  });

  it("okunmayan vurgu rengiyle ilan.json kurulmuyor, nedeni söyleniyor", () => {
    const veri = { ...temurlarVerisi() } as Record<string, unknown>;
    delete veri.fotograflar;
    delete veri.emlakOfisi;
    const fotograflar = [{ dosyaAdi: "01.jpg", tur: "bina" }];
    const sonuc = ilanJsonuOlustur(veri, { ad: "Temurlar Grup" }, fotograflar, { tema: "acik", vurguRengi: "#F2A541" });
    expect(sonuc).toMatchObject({ basarili: false, hatalar: [expect.stringContaining("açık temada okunmuyor")] });
    expect(ilanJsonuOlustur(veri, { ad: "Temurlar Grup" }, fotograflar, { tema: "koyu", vurguRengi: "#F2A541" }).basarili).toBe(true);
  });

  it("şirket ayarları formu: telefonları biçimlendiriyor, web adresini temizliyor, rengi varsayılan temaya göre kontrol ediyor", () => {
    const sonuc = ofisAyarFormunuDogrula({
      ad: " Temurlar Grup ",
      telefon: "02722120000",
      cepTelefonu: "05057094488",
      yetkiBelgeNo: "0300206",
      eposta: "Bilgi@Temurlar.com",
      web: "https://www.TemurlarGrup.com/",
      il: "Afyonkarahisar",
      tema: "koyu",
      vurguKendi: "on",
      vurguRengi: "#f2a541",
      varsayilanMuzikId: "",
      "kapanis.web": "on",
    });
    expect(sonuc).toMatchObject({
      basarili: true,
      veri: {
        ad: "Temurlar Grup",
        telefon: "0272 212 00 00",
        cepTelefonu: "0505 709 44 88",
        eposta: "bilgi@temurlar.com",
        web: "temurlargrup.com",
        il: "Afyonkarahisar",
        adres: null,
        vurguRengi: "#F2A541",
        kapanisAlanlari: ["web"],
        varsayilanMuzikId: null,
        varsayilanResimId: null,
      },
    });
    // "Temanın kendi rengi" seçiliyse renk kutusundaki değer yok sayılır.
    expect(ofisAyarFormunuDogrula({ ad: "A", tema: "acik", vurguRengi: "#F2A541" })).toMatchObject({ basarili: true, veri: { vurguRengi: null, telefon: null } });
    const hatali = ofisAyarFormunuDogrula({ ad: "", telefon: "123", yetkiBelgeNo: "A1", eposta: "bilgi", web: "temurlar", tema: "acik", vurguKendi: "on", vurguRengi: "#F2A541" });
    expect(hatali.basarili).toBe(false);
    if (!hatali.basarili) {
      expect(Object.keys(hatali.hatalar).sort()).toEqual(["ad", "eposta", "telefon", "vurguRengi", "web", "yetkiBelgeNo"]);
      expect(hatali.hatalar.vurguRengi).toContain("açık temada okunmuyor");
    }
    expect(ofisAyarFormunuDogrula({ ad: "A", tema: "mor" })).toMatchObject({ basarili: false, hatalar: { tema: expect.any(String) } });
  });

  it("kapanışta gösterilmek üzere seçilen bilgi boşsa kaydetmiyor", () => {
    const sonuc = ofisAyarFormunuDogrula({ ad: "A", tema: "koyu", "kapanis.yetkili": "on", "kapanis.eposta": "on", eposta: "a@b.co" });
    expect(sonuc).toMatchObject({ basarili: false, hatalar: { "kapanis.yetkili": expect.stringContaining("yetkili adı soyadı") } });
    if (!sonuc.basarili) expect(sonuc.hatalar["kapanis.eposta"]).toBeUndefined();
  });

  it("kapanış resmi seçimi müzikle aynı kuralı izliyor", () => {
    const o = { varsayilanResimId: "r0" };
    expect(ilanResimId(o, { resimSecimi: "ofis", resimId: null })).toBe("r0");
    expect(ilanResimId(o, { resimSecimi: "yok", resimId: "r1" })).toBeNull();
    expect(ilanResimId(o, { resimSecimi: "secili", resimId: "r1" })).toBe("r1");
    expect(ilanResimId({ varsayilanResimId: null }, { resimSecimi: "ofis", resimId: null })).toBeNull();
  });

  it("şirket bilgilerinden yalnızca seçilen ve dolu olanlar, ekran biçiminde kapanışa gidiyor", () => {
    const sirket = { adres: "Cumhuriyet Mah. 12", il: "Afyonkarahisar", ilce: "Merkez", eposta: null, web: "temurlar.com", yetkiliAdi: "Ayşe", yetkiliSoyadi: "Yılmaz" };
    expect(sirketBilgileri({ ...sirket, kapanisAlanlari: ["adres", "yetkili", "eposta"] })).toEqual({
      adres: "Cumhuriyet Mah. 12, Merkez/Afyonkarahisar",
      yetkili: "Ayşe Yılmaz",
    });
    expect(sirketBilgileri({ ...sirket, kapanisAlanlari: [] })).toBeUndefined();
    const alanlar = gorunumAlanlari({ ...ofis, ...sirket, kapanisAlanlari: ["web"] }, { tema: null }, null, { id: "r", ofisId: "o", anahtar: "ofis/o/resim/a.jpg", genislik: 1, yukseklik: 1, olusturma: new Date(), guncelleme: new Date() });
    expect(alanlar).toMatchObject({ kapanisResmi: "kapanis.jpg", sirketBilgileri: { web: "temurlar.com" } });
  });

});
