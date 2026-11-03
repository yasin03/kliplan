import { writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { ilanKlasorunuDogrula } from "../src/pipeline/dogrulama.js";
import { eksikFotograflariUret } from "../src/pipeline/ornekGorsel.js";
import type { Fotograf } from "../src/schema/ilan.js";
import { geciciIlanKlasoru, gercekFotografGibi, temurlarVerisi } from "./yardimci.js";

describe("ÖRNEK yer tutucu görseller", () => {
  it("yalnızca eksik dosyaları üretiyor ve gerçek fotoğrafa dokunmuyor", async () => {
    const klasor = await geciciIlanKlasoru(temurlarVerisi(), ["02-salon.png"]);
    const fotograflar = temurlarVerisi().fotograflar as Fotograf[];

    const uretilenler = await eksikFotograflariUret(klasor, fotograflar);
    expect(uretilenler).toHaveLength(6);
    expect(uretilenler).not.toContain("02-salon.png");

    const bina = await sharp(path.join(klasor, "fotograflar", "01-bina.png")).metadata();
    const salon = await sharp(path.join(klasor, "fotograflar", "03-mutfak.png")).metadata();
    expect([bina.width, bina.height]).toEqual([1080, 1440]);
    expect([salon.width, salon.height]).toEqual([1600, 1200]);

    expect(await eksikFotograflariUret(klasor, fotograflar)).toEqual([]);
  });

  it("örnek görselleri uyarı olarak raporluyor, gerçekle değiştirilince uyarıyı kaldırıyor", async () => {
    const klasor = await geciciIlanKlasoru(temurlarVerisi());
    await eksikFotograflariUret(klasor, temurlarVerisi().fotograflar as Fotograf[]);

    let { rapor } = await ilanKlasorunuDogrula(klasor);
    expect(rapor.gecerli).toBe(true);
    expect(rapor.uyarilar.filter((u) => u.mesaj.includes("ÖRNEK yer tutucu"))).toHaveLength(7);

    await writeFile(path.join(klasor, "fotograflar", "01-bina.png"), await gercekFotografGibi("#336699"));
    ({ rapor } = await ilanKlasorunuDogrula(klasor));
    expect(rapor.uyarilar.filter((u) => u.mesaj.includes("ÖRNEK yer tutucu"))).toHaveLength(6);
  });
});
