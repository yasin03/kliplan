import { mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { anahtariDogrula, aralikCoz, DepolamaHatasi, imzaGecerliMi, imzala } from "../src/depolama/Depolama.js";
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

describe("indirme bağlantısı ve aralık", () => {
  it("indirme adı imzaya giriyor; ad değiştirilirse bağlantı geçersiz", async () => {
    const son = Date.now() + 60_000;
    const imza = imzala(ANAHTAR, son, GIZLI, "kliplan-video-s1.mp4");
    expect(imzaGecerliMi(ANAHTAR, son, imza, GIZLI, Date.now(), "kliplan-video-s1.mp4")).toBe(true);
    expect(imzaGecerliMi(ANAHTAR, son, imza, GIZLI, Date.now(), "baska.mp4")).toBe(false);
    expect(imzaGecerliMi(ANAHTAR, son, imza, GIZLI)).toBe(false);

    const depolama = new YerelDepolama("/tmp/yok", GIZLI);
    await expect(depolama.imzaliBaglanti(ANAHTAR, 60, 'kötü"ad.mp4')).rejects.toThrow("Geçersiz indirme adı");
    await expect(depolama.imzaliBaglanti(ANAHTAR, 60, "kliplan-video-s1.mp4")).resolves.toMatch(/&indir=kliplan-video-s1\.mp4$/);
  });

  it.each([
    [null, null],
    ["bytes=0-", { bas: 0, son: 999 }],
    ["bytes=0-1", { bas: 0, son: 1 }],
    ["bytes=500-2000", { bas: 500, son: 999 }],
    ["bytes=-100", { bas: 900, son: 999 }],
    ["bytes=1000-", "gecersiz"],
    ["bytes=5-2", "gecersiz"],
    ["bytes=0-1,5-6", "gecersiz"],
    ["items=0-1", "gecersiz"],
  ] as const)("Range %s → %j", (baslik, beklenen) => {
    expect(aralikCoz(baslik, 1000)).toEqual(beklenen);
  });
});

describe("yerel depoda önekle silme", () => {
  it("ofisin tamamını silebiliyor; klasör dışına çıkan öneki reddediyor", async () => {
    const depo = new YerelDepolama(await mkdtemp(path.join(tmpdir(), "kliplan-onek-")), "gizli");
    await depo.yaz("ofis/a1/logo/l.png", Buffer.from("l"), "image/png");
    await depo.yaz("ofis/a2/logo/l.png", Buffer.from("l"), "image/png");
    await depo.onekSil("ofis/a1/");
    await expect(depo.oku("ofis/a1/logo/l.png")).rejects.toThrow();
    expect((await depo.oku("ofis/a2/logo/l.png")).toString()).toBe("l");
    await expect(depo.onekSil("../")).rejects.toThrow("Geçersiz");
    await expect(depo.onekSil("ofis/")).rejects.toThrow("Geçersiz");
  });
});
