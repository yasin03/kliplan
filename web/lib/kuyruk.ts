import { type Kuyruk, kuyrukOlustur, redisBaglantisi } from "@cekirdek/worker/kuyruk.js";

/** Geliştirmede her kod değişikliğinde yeni Redis bağlantısı açılmasın diye tek örnek tutulur. */
const kuresel = globalThis as unknown as { kliplanKuyruk?: Kuyruk };

export const kuyruk = () => (kuresel.kliplanKuyruk ??= kuyrukOlustur(redisBaglantisi()));
