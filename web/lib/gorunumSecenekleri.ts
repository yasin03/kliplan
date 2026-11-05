import { TEMALAR } from "@cekirdek/remotion/temalar.js";
import type { Depo } from "@cekirdek/veri/depo.js";
import { ofisTemasi } from "@cekirdek/veri/gorunum.js";
import type { ResimSecenegi } from "@/components/ResimSecici";

type Ofis = Awaited<ReturnType<Depo["ayarlanacakOfis"]>>;

/**
 * Şirketin tema, müzik ve kapanış resmi seçenekleri: ilan formu, ilan sayfası kartı ve şirket ayarları ortak kullanır.
 * Resimlerin kısa ömürlü bağlantıları burada üretilir. Yetki `depo` ile sınırlıdır.
 */
export async function gorunumSecenekleri(depo: Depo, ofis: Ofis) {
  const [muzikler, resimler] = await Promise.all([depo.muzikler(ofis.id), depo.resimler(ofis.id)]);
  const adresler = await Promise.all(resimler.map((r) => depo.dosyaBaglantisi(r.anahtar)));
  const resimSecenekleri: ResimSecenegi[] = resimler.map((r, i) => ({ deger: r.id, etiket: `Resim ${i + 1}`, adres: adresler[i]! }));
  const varsayilanResim = resimSecenekleri.find((r) => r.deger === ofis.varsayilanResimId) ?? null;
  return {
    ofisTemasi: ofisTemasi(ofis),
    ofisTemaAdi: TEMALAR[ofisTemasi(ofis)].ad,
    muzikler: muzikler.map((m) => ({ id: m.id, ad: m.ad, kutuphane: m.ofisId === null })),
    ofisMuzigi: muzikler.find((m) => m.id === ofis.varsayilanMuzikId)?.ad ?? null,
    /** Şirket ayarlarındaki "varsayılan resim" için: resim yok + resimler. */
    resimler: resimSecenekleri,
    /** İlan için: şirket varsayılanı + resim yok + resimler. */
    ilanResimSecenekleri: [
      { deger: "", etiket: `Şirket varsayılanı (${varsayilanResim ? varsayilanResim.etiket : "ilan fotoğrafı"})`, adres: varsayilanResim?.adres ?? null },
      { deger: "yok", etiket: "İlan fotoğrafı", adres: null },
      ...resimSecenekleri,
    ] satisfies ResimSecenegi[],
  };
}

export type GorunumSecenekleri = Awaited<ReturnType<typeof gorunumSecenekleri>>;

/** Kayıttaki seçim → formdaki değer: "" şirket varsayılanı, "yok", veya kimlik. */
export const secimDegeri = (secim: string, id: string | null) => (secim === "yok" ? "yok" : secim === "secili" && id ? id : "");
