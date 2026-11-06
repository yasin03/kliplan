import type { Iletisim, Sahne, VideoProps } from "../remotion/tipler.js";
import { gorunur, type Ilan } from "../schema/ilan.js";
import { fiyatEkranMetni, konumEkranMetni } from "./bicim.js";
import type { HazirlikSonucu } from "./fotografHazirlama.js";

export class VideoVerisiHatasi extends Error {}

/** Kapanış sahnesinin bilgileri. Gizlenen bilgi karta girmez; gösterilen fiyat, telefon veya yetki belgesi onaysızsa video üretilmez. */
export function iletisimBilgisi(ilan: Ilan): Iletisim {
  const fiyat = gorunur(ilan, "fiyat");
  const telefon = gorunur(ilan, "telefon");
  const yetkiBelgeNo = gorunur(ilan, "yetkiBelgeNo");
  const eksikler = [
    fiyat && !ilan.fiyatTl.onayli && "fiyat",
    telefon && !ilan.telefon.onayli && "telefon",
    yetkiBelgeNo && !ilan.yetkiBelgeNo.onayli && "yetki belge numarası",
  ].filter(Boolean);
  if (eksikler.length > 0) {
    throw new VideoVerisiHatasi(
      `Kapanış sahnesi için ${eksikler.join(", ")} onaylı olmalı. Emlakçıyla doğrulayıp ilan.json'da "onayli": true yapın.`,
    );
  }
  const ekSatirlar = SIRKET_SATIRLARI.map((ad) => ilan.sirketBilgileri?.[ad]).filter((d): d is string => Boolean(d));
  return {
    fiyat: fiyat ? fiyatEkranMetni(ilan.fiyatTl.deger) : undefined,
    telefon: telefon ? ilan.telefon.deger : undefined,
    yetkiBelgeNo: yetkiBelgeNo ? ilan.yetkiBelgeNo.deger : undefined,
    konum: ilan.konum.onayli && gorunur(ilan, "konum") ? konumEkranMetni(ilan.konum) : undefined,
    ...(ekSatirlar.length ? { ekSatirlar } : {}),
  };
}

/** Kapanış kartındaki şirket bilgilerinin sırası. */
const SIRKET_SATIRLARI = ["web", "adres", "yetkili", "eposta"] as const;

export function videoPropsOlustur(ilan: Ilan, sahneler: Sahne[], hazirlik: HazirlikSonucu): VideoProps {
  for (const [sira, sahne] of sahneler.entries()) {
    if (!hazirlik.fotograflar[sahne.fotograf]) {
      throw new VideoVerisiHatasi(`Sahne ${sira + 1}: "${sahne.fotograf}" ilan.json'daki fotoğraf listesinde yok.`);
    }
  }
  return {
    sahneler,
    fotograflar: hazirlik.fotograflar,
    ofis: { ad: ilan.emlakOfisi, logo: hazirlik.logo },
    iletisim: iletisimBilgisi(ilan),
    muzik: hazirlik.muzik,
    kapanisFotografi: hazirlik.kapanisResmi,
    vurguRengi: ilan.vurguRengi,
    tema: ilan.tema,
  };
}
