"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { type AlanHatalari, type FormAlanlari, fotografTuruMu, ilanFormunuDogrula } from "@cekirdek/veri/ilanFormu.js";
import { kullaniciMesaji } from "@/lib/hatalar";
import { girisGerekli } from "@/lib/oturum";

export type FormDurumu = { hatalar: AlanHatalari; mesaj: string | null; degerler: FormAlanlari };
export type EylemSonucu = { hata: string | null };

const formAlanlari = (form: FormData): FormAlanlari =>
  Object.fromEntries([...form.entries()].filter(([ad, d]) => typeof d === "string" && !ad.startsWith("$ACTION")).map(([ad, d]) => [ad, d as string]));

/** Bilinen hatayı mesaja çevirir; beklenmeyen hata Next.js'in hata sayfasına gider ve loglanır. */
async function eylem(is: () => Promise<void>): Promise<EylemSonucu> {
  try {
    await is();
  } catch (hata) {
    const mesaj = kullaniciMesaji(hata);
    if (!mesaj) throw hata;
    return { hata: mesaj };
  }
  refresh();
  return { hata: null };
}

/** Yeni ilan (`ilanId` boş) veya mevcut ilanın bilgileri. Hata varsa girilen değerler geri döner, form boşalmaz. */
export async function ilanKaydet(ilanId: string | null, _onceki: FormDurumu, form: FormData): Promise<FormDurumu> {
  const { depo, yetki } = await girisGerekli();
  const degerler = formAlanlari(form);
  const sonuc = ilanFormunuDogrula(degerler);
  if (!sonuc.basarili) {
    return { hatalar: sonuc.hatalar, mesaj: "Bazı alanlar eksik veya hatalı. İşaretli alanları düzeltin.", degerler };
  }

  let hedef: string;
  try {
    if (ilanId) {
      await depo.ilanBilgileriniKaydet(ilanId, sonuc.veri);
      hedef = `/ilan/${ilanId}`;
    } else {
      let ofisId: string | undefined;
      if (yetki.admin) {
        ofisId = (await depo.ofisler()).find((o) => o.id === degerler.ofisId)?.id;
        if (!ofisId) return { hatalar: { ofisId: "Ofis seçin." }, mesaj: "İlanın hangi ofise ait olduğunu seçin.", degerler };
      }
      const kayit = await depo.ilanOlustur(sonuc.veri, ofisId);
      hedef = `/ilan/${kayit.id}/fotograflar`;
    }
  } catch (hata) {
    const mesaj = kullaniciMesaji(hata);
    if (!mesaj) throw hata;
    return { hatalar: {}, mesaj, degerler };
  }
  redirect(hedef);
}

export async function ilanSil(ilanId: string): Promise<EylemSonucu> {
  const { depo } = await girisGerekli();
  const sonuc = await eylem(() => depo.ilanSil(ilanId));
  if (!sonuc.hata) redirect("/");
  return sonuc;
}

export async function fotografTuruDegistir(fotografId: string, tur: string): Promise<EylemSonucu> {
  const { depo } = await girisGerekli();
  if (!fotografTuruMu(tur)) return { hata: "Geçersiz fotoğraf türü." };
  return eylem(() => depo.fotografTuruDegistir(fotografId, tur));
}

export async function fotografSil(fotografId: string): Promise<EylemSonucu> {
  const { depo } = await girisGerekli();
  return eylem(() => depo.fotografSil(fotografId));
}

export async function fotograflariSirala(ilanId: string, siralama: string[]): Promise<EylemSonucu> {
  const { depo } = await girisGerekli();
  return eylem(() => depo.fotograflariSirala(ilanId, siralama));
}
