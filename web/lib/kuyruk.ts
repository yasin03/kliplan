import { type Kuyruk, kuyrukOlustur, redisBaglantisi } from "@cekirdek/worker/kuyruk.js";

/** Geliştirmede her kod değişikliğinde yeni Redis bağlantısı açılmasın diye tek örnek tutulur. */
const kuresel = globalThis as unknown as { kliplanKuyruk?: Kuyruk };

export const kuyruk = () => (kuresel.kliplanKuyruk ??= kuyrukOlustur(redisBaglantisi()));

/**
 * Kuyruğa bağlı worker var mı? İş "sırada" takılı kaldığında panel nedenini söyler. Redis'e 2 saniyede ulaşılamazsa
 * `null` (bilinmiyor) döner; sayfa beklemez.
 */
export async function workerVarMi(): Promise<boolean | null> {
  let sayac: NodeJS.Timeout | undefined;
  try {
    const sayi = await Promise.race([
      kuyruk().getWorkersCount(),
      new Promise<never>((_, reddet) => {
        sayac = setTimeout(() => reddet(new Error("zaman aşımı")), 2000);
      }),
    ]);
    return sayi > 0;
  } catch {
    return null;
  } finally {
    clearTimeout(sayac);
  }
}

/** İlan üretimde, iş sırada ve kuyruğa bağlı worker yok mu? İlan ve senaryo sayfaları "servis çalışmıyor" uyarısı için kullanır. */
export async function workerYokMu(uretiliyor: boolean, sonIs: { durum: string } | null): Promise<boolean> {
  return uretiliyor && sonIs?.durum === "bekliyor" ? (await workerVarMi()) === false : false;
}
