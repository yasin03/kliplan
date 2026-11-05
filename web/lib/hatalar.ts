import { notFound } from "next/navigation";
import { DuzenlemeHatasi } from "@cekirdek/veri/depo.js";
import { FotografHatasi } from "@cekirdek/veri/fotografIsleme.js";
import { BulunamadiHatasi, ErisimHatasi } from "@cekirdek/veri/yetki.js";

/** Kullanıcıya olduğu gibi gösterilebilecek hatanın mesajı; diğerleri için `null` (genel mesaj gösterilir, hata loglanır). */
export function kullaniciMesaji(hata: unknown): string | null {
  if (hata instanceof DuzenlemeHatasi || hata instanceof ErisimHatasi || hata instanceof FotografHatasi || hata instanceof BulunamadiHatasi) {
    return hata.message;
  }
  return null;
}

/** Sayfalarda: başka ofisin veya silinmiş ilanı 404 olarak gösterir. */
export async function bulunamazsa404<T>(is: Promise<T>): Promise<T> {
  try {
    return await is;
  } catch (hata) {
    if (hata instanceof BulunamadiHatasi) notFound();
    throw hata;
  }
}
