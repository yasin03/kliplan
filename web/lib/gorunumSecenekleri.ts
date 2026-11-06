import { TEMALAR } from "@cekirdek/remotion/temalar.js";
import type { Depo } from "@cekirdek/veri/depo.js";
import { ofisTemasi } from "@cekirdek/veri/gorunum.js";
import type { ResimSecenegi } from "@/components/ResimSecici";

type Ofis = Awaited<ReturnType<Depo["ayarlanacakOfis"]>>;

/**
 * Şirketin tema, müzik, logo ve kapanış resmi seçenekleri: ilan formu, ilan sayfası kartı ve şirket ayarları ortak kullanır.
 * Resimlerin kısa ömürlü bağlantıları burada üretilir. Yetki `depo` ile sınırlıdır.
 */
export async function gorunumSecenekleri(depo: Depo, ofis: Ofis) {
  const [muzikler, resimler, logolar] = await Promise.all([depo.muzikler(ofis.id), depo.resimler(ofis.id), depo.logolar(ofis.id)]);
  const [adresler, logoAdresleri] = await Promise.all([
    Promise.all(resimler.map((r) => depo.dosyaBaglantisi(r.anahtar))),
    Promise.all(logolar.map((l) => depo.dosyaBaglantisi(l.anahtar))),
  ]);
  const resimSecenekleri: ResimSecenegi[] = resimler.map((r, i) => ({ deger: r.id, etiket: `Resim ${i + 1}`, adres: adresler[i]! }));
  const logoSecenekleri: ResimSecenegi[] = logolar.map((l, i) => ({ deger: l.id, etiket: `Logo ${i + 1}`, adres: logoAdresleri[i]! }));
  const varsayilanResim = resimSecenekleri.find((r) => r.deger === ofis.varsayilanResimId) ?? null;
  const varsayilanLogo = logoSecenekleri.find((l) => l.deger === ofis.varsayilanLogoId) ?? null;
  return {
    ofisTemasi: ofisTemasi(ofis),
    ofisTemaAdi: TEMALAR[ofisTemasi(ofis)].ad,
    muzikler: muzikler.map((m) => ({ id: m.id, ad: m.ad, kutuphane: m.ofisId === null })),
    ofisMuzigi: muzikler.find((m) => m.id === ofis.varsayilanMuzikId)?.ad ?? null,
    /** Şirket ayarlarındaki "varsayılan resim" için: resim yok + resimler. */
    resimler: resimSecenekleri,
    /** İlan için: şirket varsayılanı + resimler. "İlan fotoğrafı" (`yok`) "videoda göster" anahtarıyla seçilir. */
    ilanResimSecenekleri: [
      { deger: "", etiket: `Şirket varsayılanı (${varsayilanResim ? varsayilanResim.etiket : "ilan fotoğrafı"})`, adres: varsayilanResim?.adres ?? null },
      ...resimSecenekleri,
    ] satisfies ResimSecenegi[],
    /** Şirket ayarlarındaki logo listesi ve "varsayılan logo" için. */
    logolar: logoSecenekleri,
    /** İlan için: şirket varsayılanı + logolar. "Logo yok" (`yok`) anahtarla seçilir. */
    ilanLogoSecenekleri: [
      { deger: "", etiket: `Şirket varsayılanı (${varsayilanLogo ? varsayilanLogo.etiket : "logo yok"})`, adres: varsayilanLogo?.adres ?? null },
      ...logoSecenekleri,
    ] satisfies ResimSecenegi[],
  };
}

export type GorunumSecenekleri = Awaited<ReturnType<typeof gorunumSecenekleri>>;

/** Kayıttaki seçim → formdaki değer: "" şirket varsayılanı, "yok", veya kimlik. */
export const secimDegeri = (secim: string, id: string | null) => (secim === "yok" ? "yok" : secim === "secili" && id ? id : "");
