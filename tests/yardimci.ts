import { readFileSync } from "node:fs";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";

export const TEMURLAR_KLASORU = path.resolve(import.meta.dirname, "../ilanlar/temurlar");

/** Her çağrıda yeni bir kopya döner; testler birbirini etkilemez. */
export function temurlarVerisi(): Record<string, unknown> {
  return JSON.parse(readFileSync(path.join(TEMURLAR_KLASORU, "ilan.json"), "utf8")) as Record<string, unknown>;
}

/** Testlerde "gerçek fotoğraf" yerine geçen, yeterli çözünürlükte düz renkli bir JPEG. */
export const gercekFotografGibi = (renk = "#808080") =>
  sharp({ create: { width: 1600, height: 1200, channels: 3, background: renk } }).jpeg().toBuffer();

/** Geçici bir ilan klasörü kurar. `fotograflar` içindeki dosyalar düz renkli JPEG olarak oluşturulur. */
export async function geciciIlanKlasoru(ilanJson: string | object, fotograflar: string[] = []): Promise<string> {
  const klasor = await mkdtemp(path.join(tmpdir(), "kliplan-test-"));
  await mkdir(path.join(klasor, "fotograflar"));
  await writeFile(path.join(klasor, "ilan.json"), typeof ilanJson === "string" ? ilanJson : JSON.stringify(ilanJson));
  const gorsel = await gercekFotografGibi();
  for (const dosya of fotograflar) await writeFile(path.join(klasor, "fotograflar", dosya), gorsel);
  return klasor;
}

export const TEMURLAR_FOTOGRAFLARI = (temurlarVerisi().fotograflar as { dosya: string }[]).map((f) => f.dosya);

/** Sessiz 16 bit mono WAV (müzik yükleme testleri için). */
export function sessizWav(saniye: number, ornekleme = 8000): Buffer {
  const veri = saniye * ornekleme * 2;
  const b = Buffer.alloc(44 + veri);
  b.write("RIFF", 0);
  b.writeUInt32LE(36 + veri, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(ornekleme, 24);
  b.writeUInt32LE(ornekleme * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(veri, 40);
  return b;
}
