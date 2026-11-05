"use server";

import { refresh } from "next/cache";
import { ofisAyarFormunuDogrula } from "@cekirdek/veri/gorunum.js";
import type { AlanHatalari, FormAlanlari } from "@cekirdek/veri/ilanFormu.js";
import { kullaniciMesaji } from "@/lib/hatalar";
import { girisGerekli } from "@/lib/oturum";

export type AyarDurumu = { hatalar: AlanHatalari; mesaj: string | null; uyari?: string | null; kaydedildi: boolean; degerler: FormAlanlari };

const formAlanlari = (form: FormData): FormAlanlari =>
  Object.fromEntries([...form.entries()].filter(([ad, d]) => typeof d === "string" && !ad.startsWith("$ACTION")).map(([ad, d]) => [ad, d as string]));

/** `ofisId` yalnızca admin için; üye her zaman kendi şirketini düzenler. */
export async function ofisAyarlariniKaydet(ofisId: string | null, _onceki: AyarDurumu, form: FormData): Promise<AyarDurumu> {
  const { depo } = await girisGerekli();
  const degerler = formAlanlari(form);
  const sonuc = ofisAyarFormunuDogrula(degerler);
  if (!sonuc.basarili) return { hatalar: sonuc.hatalar, mesaj: "Bazı alanlar hatalı. İşaretli alanları düzeltin.", kaydedildi: false, degerler };
  let eskiAd: string | null;
  try {
    ({ eskiAd } = await depo.ofisAyarlariniKaydet(sonuc.veri, ofisId ?? undefined));
  } catch (hata) {
    const mesaj = kullaniciMesaji(hata);
    if (!mesaj) throw hata;
    return { hatalar: {}, mesaj, kaydedildi: false, degerler };
  }
  refresh();
  // Son sahnenin dış sesi şirket adını içerdiği için eski adla yazılmış senaryolar video üretiminde reddedilir.
  const uyari = eskiAd
    ? `Şirket adı "${eskiAd}" → "${sonuc.veri.ad}" oldu. Mevcut ilanların senaryosu eski adı içeriyor; video üretmeden önce senaryoyu yeniden üretin veya son sahneyi düzenleyin.`
    : null;
  return { hatalar: {}, mesaj: null, uyari, kaydedildi: true, degerler };
}

export async function resimSil(resimId: string): Promise<{ hata: string | null }> {
  const { depo } = await girisGerekli();
  try {
    await depo.resimSil(resimId);
  } catch (hata) {
    const mesaj = kullaniciMesaji(hata);
    if (!mesaj) throw hata;
    return { hata: mesaj };
  }
  refresh();
  return { hata: null };
}

export async function logoSil(ofisId: string | null): Promise<{ hata: string | null }> {
  const { depo } = await girisGerekli();
  try {
    await depo.logoSil(ofisId ?? undefined);
  } catch (hata) {
    const mesaj = kullaniciMesaji(hata);
    if (!mesaj) throw hata;
    return { hata: mesaj };
  }
  refresh();
  return { hata: null };
}
