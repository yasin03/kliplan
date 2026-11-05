import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand, type S3Client } from "@aws-sdk/client-s3";

/**
 * Veritabanı yedekleri ayrı bir bucket'ta (`YEDEK_S3_*`), `postgres/` altında tutulur. Uygulamanın dosya anahtarı kuralları
 * (`ofis/...`) burada geçerli değil; bu bucket'a yalnızca yedek komutu erişir.
 */
export const YEDEK_ONEKI = "postgres/";

export type Yedek = { anahtar: string; tarih: Date; boyutBayt: number };

export async function yedekleriListele(istemci: S3Client, bucket: string): Promise<Yedek[]> {
  const liste: Yedek[] = [];
  let devam: string | undefined;
  do {
    const sayfa = await istemci.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: YEDEK_ONEKI, ContinuationToken: devam }));
    for (const n of sayfa.Contents ?? []) {
      if (n.Key && n.LastModified) liste.push({ anahtar: n.Key, tarih: n.LastModified, boyutBayt: n.Size ?? 0 });
    }
    devam = sayfa.IsTruncated ? sayfa.NextContinuationToken : undefined;
  } while (devam);
  return liste.sort((a, b) => b.tarih.getTime() - a.tarih.getTime());
}

/** Döküm dosyasını yükler; anahtar dosya adıdır (ör. `postgres/kliplan-20261105T033000Z.dump`). */
export async function yedekYukle(istemci: S3Client, bucket: string, dosya: string): Promise<string> {
  const anahtar = `${YEDEK_ONEKI}${path.basename(dosya)}`;
  await istemci.send(new PutObjectCommand({ Bucket: bucket, Key: anahtar, Body: await readFile(dosya), ContentType: "application/octet-stream" }));
  return anahtar;
}

/** `gun` günden eski yedekleri siler; en yeni `enAz` yedek her durumda kalır (ör. yedekleme bir süre çalışmadıysa). */
export async function eskiYedekleriSil(istemci: S3Client, bucket: string, gun: number, simdi = new Date(), enAz = 3): Promise<string[]> {
  const sinir = simdi.getTime() - gun * 24 * 60 * 60 * 1000;
  const silinecek = (await yedekleriListele(istemci, bucket)).slice(enAz).filter((y) => y.tarih.getTime() < sinir);
  for (const y of silinecek) await istemci.send(new DeleteObjectCommand({ Bucket: bucket, Key: y.anahtar }));
  return silinecek.map((y) => y.anahtar);
}

export async function yedekIndir(istemci: S3Client, bucket: string, anahtar: string, hedef: string): Promise<void> {
  if (!anahtar.startsWith(YEDEK_ONEKI)) throw new Error(`Yedek anahtarı "${YEDEK_ONEKI}" ile başlamalı.`);
  const yanit = await istemci.send(new GetObjectCommand({ Bucket: bucket, Key: anahtar }));
  await writeFile(hedef, await yanit.Body!.transformToByteArray());
}
