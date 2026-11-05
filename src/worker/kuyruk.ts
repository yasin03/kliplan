import { Queue } from "bullmq";
import { Redis } from "ioredis";

/**
 * Üretim kuyruğu. İş verisi yalnızca `uretim_isi` kaydının kimliği; ilanın kendisi her seferinde
 * veritabanından okunur. Kuyruktaki iş kimliği de aynı kimliktir, aynı iş iki kez eklenemez.
 */
export const KUYRUK_ADI = "uretim";
export type IsTuru = "senaryo" | "video";
export type IsVerisi = { isId: string };

/**
 * BullMQ 6 Redis istemcisini kendisi getirmiyor ve ESM'de bağlantı ayarından istemci kuramıyor;
 * hazır ioredis istemcisi verilir. `maxRetriesPerRequest: null` worker'ın bekleyen bağlantısı için zorunlu.
 */
export function redisBaglantisi(url = process.env.REDIS_URL): Redis {
  if (!url) throw new Error("REDIS_URL tanımlı değil. .env.example dosyasındaki değeri .env'e kopyalayın.");
  return new Redis(url, { maxRetriesPerRequest: null });
}

/** Biten işler bir süre Redis'te kalır; asıl geçmiş veritabanında (`uretim_isi`). */
const GUN = 24 * 60 * 60;

export function kuyrukOlustur(baglanti: Redis) {
  return new Queue<IsVerisi, unknown, IsTuru>(KUYRUK_ADI, {
    connection: baglanti,
    defaultJobOptions: {
      // Otomatik yeniden deneme yok: hata panelde gösterilir, kullanıcı "Yeniden dene" der. Önbellek sayesinde para harcanmaz.
      attempts: 1,
      removeOnComplete: { age: 7 * GUN },
      removeOnFail: { age: 30 * GUN },
    },
  });
}

export type Kuyruk = ReturnType<typeof kuyrukOlustur>;

export async function isEkle(kuyruk: Kuyruk, isId: string, tur: IsTuru): Promise<void> {
  await kuyruk.add(tur, { isId }, { jobId: isId });
}
