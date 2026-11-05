import { mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { anahtariDogrula, DepolamaHatasi, imzaGecerliMi, imzala } from "../src/depolama/Depolama.js";
import { YerelDepolama } from "../src/depolama/YerelDepolama.js";

const GIZLI = "test-gizli-anahtar";
const ANAHTAR = "ofis/a1/ilan/i1/fotograf/01-bina.jpg";

describe("dosya anahtarı", () => {
  it("ofis önekli anahtarı kabul ediyor", () => {
    expect(anahtariDogrula(ANAHTAR)).toBe(ANAHTAR);
  });

  it.each(["ofis/a1/../b2/x.jpg", "../etc/passwd", "/ofis/a1/x.jpg", "ofis/a1/", "baska/a1/x.jpg", "ofis/a1/x y.jpg", "ofis/a1/./x.jpg"])(
    "%s anahtarını reddediyor",
    (anahtar) => {
      expect(() => anahtariDogrula(anahtar)).toThrow(DepolamaHatasi);
    },
  );
});

describe("imzalı bağlantı", () => {
  const son = Date.now() + 60_000;

  it("geçerli imzayı kabul ediyor", () => {
    expect(imzaGecerliMi(ANAHTAR, son, imzala(ANAHTAR, son, GIZLI), GIZLI)).toBe(true);
  });

  it("süresi geçmiş, değiştirilmiş veya başka dosyaya ait imzayı reddediyor", () => {
    const imza = imzala(ANAHTAR, son, GIZLI);
    expect(imzaGecerliMi(ANAHTAR, son, imza, GIZLI, son + 1)).toBe(false);
    expect(imzaGecerliMi(ANAHTAR, son + 1000, imza, GIZLI)).toBe(false);
    expect(imzaGecerliMi("ofis/b2/ilan/i9/fotograf/01-bina.jpg", son, imza, GIZLI)).toBe(false);
    expect(imzaGecerliMi(ANAHTAR, son, `${imza.slice(0, -1)}x`, GIZLI)).toBe(false);
    expect(imzaGecerliMi(ANAHTAR, son, imza, "baska-gizli")).toBe(false);
    expect(imzaGecerliMi(ANAHTAR, Number.NaN, imza, GIZLI)).toBe(false);
  });
});

describe("yerel depolama", () => {
  it("yazıyor, okuyor, önekle siliyor ve imzalı bağlantı üretiyor", async () => {
    const kok = await mkdtemp(path.join(tmpdir(), "kliplan-depo-"));
    const depo = new YerelDepolama(kok, GIZLI, "http://localhost:3100");
    await depo.yaz(ANAHTAR, Buffer.from("foto"), "image/jpeg");
    await depo.yaz("ofis/a1/ilan/i2/video.mp4", Buffer.from("video"), "video/mp4");
    expect((await depo.oku(ANAHTAR)).toString()).toBe("foto");

    const baglanti = new URL(await depo.imzaliBaglanti(ANAHTAR, 600));
    expect(baglanti.pathname).toBe(`/dosya/${ANAHTAR}`);
    const sonZaman = Number(baglanti.searchParams.get("son"));
    expect(imzaGecerliMi(ANAHTAR, sonZaman, baglanti.searchParams.get("imza")!, GIZLI)).toBe(true);

    await depo.onekSil("ofis/a1/ilan/i1/");
    await expect(depo.oku(ANAHTAR)).rejects.toThrow("Dosya bulunamadı");
    expect(await readdir(path.join(kok, "ofis/a1/ilan"))).toEqual(["i2"]);
  });

  it("imza anahtarı olmadan kurulmuyor", () => {
    expect(() => new YerelDepolama("/tmp", "")).toThrow(DepolamaHatasi);
  });
});
