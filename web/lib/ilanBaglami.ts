import type { Depo } from "@cekirdek/veri/depo.js";
import { ilanJsonuOlustur } from "@cekirdek/veri/ilanFormu.js";

/** İlan, ofisi, fotoğrafları ve pipeline'ın göreceği `ilan.json` (eksikse hatalarıyla). Sayfalar ve eylemler ortak kullanır. */
export async function ilanBaglami(depo: Depo, ilanId: string) {
  const [ilan, ofis, fotograflar] = await Promise.all([depo.ilan(ilanId), depo.ilanOfisi(ilanId), depo.fotograflar(ilanId)]);
  return { ilan, ofis, fotograflar, json: ilanJsonuOlustur(ilan.veri, ofis, fotograflar) };
}
