import { DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command, NoSuchKey, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { anahtariDogrula, type Depolama, DepolamaHatasi, GECERLI_INDIRME_ADI } from "./Depolama.js";

export type S3Ayarlari = {
  /** R2: `https://<hesap-kimliği>.r2.cloudflarestorage.com` (AB yetki alanında `.eu.` ile). */
  endpoint: string;
  bucket: string;
  erisimAnahtari: string;
  gizliAnahtar: string;
  /** R2 kullanmaz ama SDK ister: "auto". */
  bolge?: string | undefined;
  /** MinIO gibi sunucular için yol biçimli adres (`endpoint/bucket/anahtar`). R2'de gerekmez. */
  yolBicimi?: boolean | undefined;
};

/** S3 uyumlu servisler için istemci. R2 bazı checksum başlıklarını desteklemediği için SDK yalnızca zorunlu olanları gönderir. */
export function s3Istemcisi(a: S3Ayarlari): S3Client {
  return new S3Client({
    region: a.bolge ?? "auto",
    endpoint: a.endpoint,
    credentials: { accessKeyId: a.erisimAnahtari, secretAccessKey: a.gizliAnahtar },
    forcePathStyle: a.yolBicimi ?? false,
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
}

/**
 * Sunucuda Cloudflare R2. Bucket herkese kapalıdır; dosyalar yalnızca kısa ömürlü imzalı bağlantıyla açılır.
 * Bağlantıyı veri katmanı yetkiyi kontrol ettikten sonra üretir; `/dosya/...` yolu kullanılmaz.
 */
export class S3Depolama implements Depolama {
  readonly kimlik = "s3";
  private readonly istemci: S3Client;

  constructor(private readonly ayarlar: S3Ayarlari) {
    this.istemci = s3Istemcisi(ayarlar);
  }

  async yaz(anahtar: string, icerik: Buffer, icerikTuru: string): Promise<void> {
    await this.istemci.send(new PutObjectCommand({ Bucket: this.ayarlar.bucket, Key: anahtariDogrula(anahtar), Body: icerik, ContentType: icerikTuru }));
  }

  async oku(anahtar: string): Promise<Buffer> {
    try {
      const yanit = await this.istemci.send(new GetObjectCommand({ Bucket: this.ayarlar.bucket, Key: anahtariDogrula(anahtar) }));
      return Buffer.from(await yanit.Body!.transformToByteArray());
    } catch (hata) {
      if (hata instanceof NoSuchKey) throw new DepolamaHatasi(`Dosya bulunamadı: ${anahtar}`);
      throw hata;
    }
  }

  async sil(anahtar: string): Promise<void> {
    await this.istemci.send(new DeleteObjectCommand({ Bucket: this.ayarlar.bucket, Key: anahtariDogrula(anahtar) }));
  }

  /**
   * Önekteki dosyaları listeleyip tek tek siler. Toplu silme (DeleteObjects) zorunlu checksum başlığı istediği için kullanılmıyor;
   * bir ilanda en fazla birkaç düzine dosya olur.
   */
  async onekSil(onek: string): Promise<void> {
    const temiz = onek.endsWith("/") ? onek : `${onek}/`;
    anahtariDogrula(`${temiz}x`);
    let devam: string | undefined;
    do {
      const sayfa = await this.istemci.send(new ListObjectsV2Command({ Bucket: this.ayarlar.bucket, Prefix: temiz, ContinuationToken: devam }));
      for (const nesne of sayfa.Contents ?? []) {
        if (nesne.Key) await this.istemci.send(new DeleteObjectCommand({ Bucket: this.ayarlar.bucket, Key: nesne.Key }));
      }
      devam = sayfa.IsTruncated ? sayfa.NextContinuationToken : undefined;
    } while (devam);
  }

  async imzaliBaglanti(anahtar: string, sureSn: number, indirmeAdi?: string): Promise<string> {
    if (indirmeAdi !== undefined && !GECERLI_INDIRME_ADI.test(indirmeAdi)) throw new DepolamaHatasi(`Geçersiz indirme adı: ${indirmeAdi}`);
    const komut = new GetObjectCommand({
      Bucket: this.ayarlar.bucket,
      Key: anahtariDogrula(anahtar),
      ...(indirmeAdi ? { ResponseContentDisposition: `attachment; filename="${indirmeAdi}"` } : {}),
    });
    return getSignedUrl(this.istemci, komut, { expiresIn: sureSn });
  }
}
