import type { Depo } from "@cekirdek/veri/depo.js";
import { gorunumAlanlari } from "@cekirdek/veri/gorunum.js";
import { ilanJsonuOlustur } from "@cekirdek/veri/ilanFormu.js";

/**
 * İlan, ofisi, fotoğrafları, müziği, kapanış resmi ve pipeline'ın göreceği `ilan.json` (eksikse hatalarıyla). Sayfalar ve eylemler ortak kullanır.
 * Görünüm alanları worker'daki gibi kurulur; böylece kontrol listesi (müzik lisansı) ve vurgu rengi kontrolü videoyla aynı olur.
 */
export async function ilanBaglami(depo: Depo, ilanId: string) {
  const [ilan, ofis, fotograflar, muzik, resim] = await Promise.all([
    depo.ilan(ilanId),
    depo.ilanOfisi(ilanId),
    depo.fotograflar(ilanId),
    depo.ilanMuzigi(ilanId),
    depo.ilanResmi(ilanId),
  ]);
  const gorunum = gorunumAlanlari(ofis, ilan, muzik, resim);
  return { ilan, ofis, fotograflar, muzik, resim, gorunum, json: ilanJsonuOlustur(ilan.veri, ofis, fotograflar, gorunum) };
}
