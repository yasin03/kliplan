import { writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { ilanKlasorunuDogrula } from "../src/pipeline/dogrulama.js";
import { geciciIlanKlasoru, TEMURLAR_FOTOGRAFLARI, temurlarVerisi } from "./yardimci.js";

describe("ilan klasörü doğrulaması", () => {
  it("tüm fotoğraflar varsa geçerli sayıyor", async () => {
    const klasor = await geciciIlanKlasoru(temurlarVerisi(), TEMURLAR_FOTOGRAFLARI);
    const { ilan, rapor } = await ilanKlasorunuDogrula(klasor);
    expect(ilan).not.toBeNull();
    expect(rapor.hatalar).toEqual([]);
  });

  it("var olmayan fotoğrafı hata olarak raporluyor", async () => {
    const klasor = await geciciIlanKlasoru(
      temurlarVerisi(),
      TEMURLAR_FOTOGRAFLARI.filter((d) => d !== "03-mutfak.png"),
    );
    const { rapor } = await ilanKlasorunuDogrula(klasor);
    expect(rapor.gecerli).toBe(false);
    expect(rapor.hatalar).toEqual([
      {
        seviye: "hata",
        alan: "Fotoğraflar → 3. öğe",
        mesaj: "Fotoğraf dosyası bulunamadı: fotograflar/03-mutfak.png",
      },
    ]);
  });

  it("onaysız kira durumunu uyarı olarak ekliyor", async () => {
    const klasor = await geciciIlanKlasoru(temurlarVerisi(), TEMURLAR_FOTOGRAFLARI);
    const { rapor } = await ilanKlasorunuDogrula(klasor);
    expect(rapor.gecerli).toBe(true);
    const kira = rapor.uyarilar.find((u) => u.alan === "Kira durumu");
    expect(kira?.mesaj).toContain('"Kiracılı" (25.000 TL) onaylı değil, videoda kullanılmayacak.');
    expect(kira?.mesaj).toContain("Kiranın aylık olduğu açıkça belirtilmemiş");
    expect(rapor.markdown()).toContain("## Uyarılar\n\n- **Kira durumu:**");
  });

  it("kira onaylıysa uyarı vermiyor", async () => {
    const veri = temurlarVerisi();
    (veri.kiraDurumu as Record<string, unknown>).onayli = true;
    const klasor = await geciciIlanKlasoru(veri, TEMURLAR_FOTOGRAFLARI);
    const { rapor } = await ilanKlasorunuDogrula(klasor);
    expect(rapor.uyarilar).toEqual([]);
  });

  it("onaysız kritik bilgiyi uyarı olarak ekliyor", async () => {
    const veri = temurlarVerisi();
    (veri.telefon as Record<string, unknown>).onayli = false;
    const klasor = await geciciIlanKlasoru(veri, TEMURLAR_FOTOGRAFLARI);
    const { rapor } = await ilanKlasorunuDogrula(klasor);
    expect(rapor.uyarilar.map((u) => u.alan)).toContain("Telefon");
  });

  it("çelişkili metrekare ve kat bilgisini uyarıyor", async () => {
    const veri = { ...temurlarVerisi(), netM2: 80, bulunduguKat: 6 };
    const klasor = await geciciIlanKlasoru(veri, TEMURLAR_FOTOGRAFLARI);
    const { rapor } = await ilanKlasorunuDogrula(klasor);
    expect(rapor.uyarilar.map((u) => u.alan)).toEqual(expect.arrayContaining(["Metrekare", "Kat"]));
  });

  it("bozuk JSON için Türkçe hata veriyor", async () => {
    const klasor = await geciciIlanKlasoru('{ "ilanNo": "1", }');
    const { ilan, rapor } = await ilanKlasorunuDogrula(klasor);
    expect(ilan).toBeNull();
    expect(rapor.hatalar[0]?.mesaj).toMatch(/^Geçerli bir JSON değil/);
  });

  it("ilan.json yoksa hata veriyor", async () => {
    const { rapor } = await ilanKlasorunuDogrula("/var/olmayan/klasor");
    expect(rapor.hatalar[0]?.mesaj).toMatch(/^Dosya bulunamadı/);
  });

  it("verilen logo dosyası yoksa hata veriyor", async () => {
    const klasor = await geciciIlanKlasoru({ ...temurlarVerisi(), logo: "logo.png" }, TEMURLAR_FOTOGRAFLARI);
    const { rapor } = await ilanKlasorunuDogrula(klasor);
    expect(rapor.hatalar).toEqual([{ seviye: "hata", alan: "Logo", mesaj: "Logo dosyası bulunamadı: logo.png" }]);
  });

  it("açılamayan görseli hata olarak raporluyor", async () => {
    const klasor = await geciciIlanKlasoru(temurlarVerisi(), TEMURLAR_FOTOGRAFLARI);
    await writeFile(path.join(klasor, "fotograflar", "05-koridor.png"), "görsel değil");
    const { rapor } = await ilanKlasorunuDogrula(klasor);
    expect(rapor.hatalar.map((h) => h.mesaj)).toEqual([
      '"05-koridor.png" açılamadı. Dosya bozuk olabilir veya gerçekte bir görsel değil.',
    ]);
  });

  it("düşük çözünürlüklü fotoğrafı uyarıyor", async () => {
    const klasor = await geciciIlanKlasoru(temurlarVerisi(), TEMURLAR_FOTOGRAFLARI);
    const kucuk = await sharp({ create: { width: 593, height: 1067, channels: 3, background: "#999" } }).jpeg().toBuffer();
    await writeFile(path.join(klasor, "fotograflar", "03-mutfak.png"), kucuk);
    const { rapor } = await ilanKlasorunuDogrula(klasor);
    expect(rapor.gecerli).toBe(true);
    expect(rapor.uyarilar.find((u) => u.alan === "Fotoğraflar → 3. öğe")?.mesaj).toMatch(
      /düşük çözünürlüklü \(593x1067\)/,
    );
  });
});
