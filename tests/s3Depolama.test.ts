import { CreateBucketCommand } from "@aws-sdk/client-s3";
import { beforeAll, describe, expect, it } from "vitest";
import { DepolamaHatasi } from "../src/depolama/Depolama.js";
import { s3Ayarlari } from "../src/depolama/index.js";
import { S3Depolama, s3Istemcisi } from "../src/depolama/S3Depolama.js";

/**
 * S3 uyumlu gerçek bir sunucuya karşı çalışır; `TEST_S3_ENDPOINT` yoksa atlanır. Yerelde denemek için:
 * docker run -d --rm --name kliplan-s3-test -p 127.0.0.1:9100:8333 chrislusf/seaweedfs server -s3 -dir=/data
 * TEST_S3_ENDPOINT=http://127.0.0.1:9100 npx vitest run tests/s3Depolama.test.ts
 * Bucket'ın imzasız erişime kapalı olması bucket ayarıdır (R2'de varsayılan); kurulum kontrol listesinde denenir.
 */
const endpoint = process.env.TEST_S3_ENDPOINT;

describe("s3 ayarları", () => {
  it("eksik değişkenleri adıyla söylüyor", () => {
    expect(() => s3Ayarlari({ S3_ENDPOINT: "https://x.r2.cloudflarestorage.com", S3_BUCKET: "b" })).toThrow("S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY");
    expect(s3Ayarlari({ YEDEK_S3_ENDPOINT: "e", YEDEK_S3_BUCKET: "b", YEDEK_S3_ACCESS_KEY_ID: "a", YEDEK_S3_SECRET_ACCESS_KEY: "s" }, "YEDEK_S3_")).toMatchObject({
      bucket: "b",
      yolBicimi: false,
    });
  });
});

describe.skipIf(!endpoint)("S3Depolama (gerçek sunucu)", () => {
  const ayarlar = {
    endpoint: endpoint!,
    bucket: `kliplan-test-${Date.now()}`,
    erisimAnahtari: process.env.TEST_S3_ACCESS_KEY_ID ?? "test",
    gizliAnahtar: process.env.TEST_S3_SECRET_ACCESS_KEY ?? "test",
    bolge: "us-east-1",
    yolBicimi: true,
  };
  const depolama = new S3Depolama(ayarlar);

  beforeAll(async () => {
    await s3Istemcisi(ayarlar).send(new CreateBucketCommand({ Bucket: ayarlar.bucket }));
  });

  it("yazıyor, okuyor, siliyor; olmayan dosyada DepolamaHatasi veriyor", async () => {
    await depolama.yaz("ofis/a/ilan/1/fotograf/x.jpg", Buffer.from("foto"), "image/jpeg");
    expect((await depolama.oku("ofis/a/ilan/1/fotograf/x.jpg")).toString()).toBe("foto");
    await depolama.sil("ofis/a/ilan/1/fotograf/x.jpg");
    await expect(depolama.oku("ofis/a/ilan/1/fotograf/x.jpg")).rejects.toBeInstanceOf(DepolamaHatasi);
    await depolama.sil("ofis/a/yok.jpg");
  });

  it("önekle silmede yalnızca o önekteki dosyalar gidiyor", async () => {
    for (const k of ["ofis/a/ilan/1/a.jpg", "ofis/a/ilan/1/video/1/video.mp4", "ofis/a/ilan/10/a.jpg"]) await depolama.yaz(k, Buffer.from(k), "image/jpeg");
    await depolama.onekSil("ofis/a/ilan/1/");
    await expect(depolama.oku("ofis/a/ilan/1/a.jpg")).rejects.toBeInstanceOf(DepolamaHatasi);
    await expect(depolama.oku("ofis/a/ilan/1/video/1/video.mp4")).rejects.toBeInstanceOf(DepolamaHatasi);
    expect((await depolama.oku("ofis/a/ilan/10/a.jpg")).toString()).toBe("ofis/a/ilan/10/a.jpg");
  });

  it("imzalı bağlantı dosyayı açıyor, Range ve indirme adını destekliyor", async () => {
    await depolama.yaz("ofis/a/ilan/2/video.mp4", Buffer.from("0123456789"), "video/mp4");
    const baglanti = await depolama.imzaliBaglanti("ofis/a/ilan/2/video.mp4", 60, "kliplan-video-s1.mp4");
    const yanit = await fetch(baglanti, { headers: { Range: "bytes=2-4" } });
    expect(yanit.status).toBe(206);
    expect(await yanit.text()).toBe("234");
    expect(yanit.headers.get("content-disposition")).toBe('attachment; filename="kliplan-video-s1.mp4"');
    await expect(depolama.imzaliBaglanti("ofis/a/x.mp4", 60, "kötü ad.mp4")).rejects.toBeInstanceOf(DepolamaHatasi);
  });
});
