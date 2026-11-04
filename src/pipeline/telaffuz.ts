import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { TelaffuzSozlugu } from "../providers/TtsProvider.js";
import type { Ilan } from "../schema/ilan.js";

const PROJE_SOZLUGU = path.resolve(import.meta.dirname, "../../telaffuz.json");

const sozlukSemasi = z.record(z.string().trim().min(1), z.union([z.string().trim().min(1), z.strictObject({ ipa: z.string().trim().min(1) })]));

export class TelaffuzHatasi extends Error {}

/** Projedeki `telaffuz.json` ile ilana özel `telaffuz` alanını birleştirir; aynı kelimede ilandaki geçerlidir. */
export async function telaffuzSozlugu(ilan: Ilan, dosya = PROJE_SOZLUGU): Promise<TelaffuzSozlugu> {
  let proje: TelaffuzSozlugu = {};
  try {
    const sonuc = sozlukSemasi.safeParse(JSON.parse(await readFile(dosya, "utf8")));
    if (!sonuc.success) throw new TelaffuzHatasi(`Telaffuz sözlüğü geçersiz (${dosya}). Değerler metin ya da { "ipa": "..." } olmalı.`);
    proje = sonuc.data;
  } catch (hata) {
    if (hata instanceof TelaffuzHatasi) throw hata;
    if ((hata as NodeJS.ErrnoException).code !== "ENOENT") throw new TelaffuzHatasi(`Telaffuz sözlüğü okunamadı: ${dosya}`);
  }
  return { ...proje, ...ilan.telaffuz };
}
