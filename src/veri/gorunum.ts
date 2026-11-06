import path from "node:path";
import type { muzik, Secim, sirketLogosu, sirketResmi } from "../db/sema.js";
import { VURGU_DESENI, vurguHatasi } from "../pipeline/renk.js";
import { TEMA_ADLARI, type TemaAdi, temaAdiMi, VARSAYILAN_TEMA } from "../remotion/temalar.js";
import type { Ilan } from "../schema/ilan.js";
import { type AlanHatalari, type FormAlanlari, telefonuBicimlendir } from "./ilanFormu.js";
import { KAPANIS_ALANI_ADLARI, KAPANIS_ALANLARI, type KapanisAlani } from "./kapanisAlanlari.js";

/**
 * Şirket ayarları (logo, vurgu rengi, tema, varsayılan müzik ve resim, kapanış bilgileri) ile ilanın kendi seçiminden
 * videonun görünümünü çıkarır. Worker `ilan.json`'u, panel eksik ve uyarıları bununla kurar.
 */

export { SECIMLER, type Secim } from "../db/sema.js";
export { KAPANIS_ALANI_ADLARI, KAPANIS_ALANLARI, type KapanisAlani } from "./kapanisAlanlari.js";
export type MuzikKaydi = typeof muzik.$inferSelect;
export type ResimKaydi = typeof sirketResmi.$inferSelect;
export type LogoKaydi = typeof sirketLogosu.$inferSelect;
type SirketBilgisi = {
  adres: string | null;
  il: string | null;
  ilce: string | null;
  eposta: string | null;
  web: string | null;
  yetkiliAdi: string | null;
  yetkiliSoyadi: string | null;
  kapanisAlanlari: readonly string[];
};
type OfisGorunumu = Partial<SirketBilgisi> & {
  tema: string;
  vurguRengi: string | null;
  varsayilanLogoId?: string | null;
  varsayilanMuzikId: string | null;
  varsayilanResimId?: string | null;
};
type IlanSecimi = {
  tema: string | null;
  muzikSecimi: Secim;
  muzikId: string | null;
  resimSecimi?: Secim;
  resimId?: string | null;
  logoSecimi?: Secim;
  logoId?: string | null;
};


/** Panelde ve kontrol listesinde emlakçının onayladığı beyan. Değiştirilirse eski yüklemelerin kaydında eski metin kalır. */
export const MUZIK_BEYANI =
  "Bu müziği ticari amaçlı tanıtım videolarında kullanma iznim (lisansım) olduğunu, iznin kapsamını ve süresini kontrol ettiğimi beyan ederim.";

export const ofisTemasi = (ofis: Pick<OfisGorunumu, "tema">): TemaAdi => (temaAdiMi(ofis.tema) ? ofis.tema : VARSAYILAN_TEMA);

export const ilanTemasi = (ofis: Pick<OfisGorunumu, "tema">, ilan: Pick<IlanSecimi, "tema">): TemaAdi => (temaAdiMi(ilan.tema) ? ilan.tema : ofisTemasi(ofis));

/** Seçim kuralı: `yok` hiç, `secili` seçilen kayıt (silinmişse şirketin varsayılanı), `ofis` şirketin varsayılanı. */
function secilenId(secim: Secim, id: string | null | undefined, varsayilan: string | null | undefined): string | null {
  if (secim === "yok") return null;
  if (secim === "secili" && id) return id;
  return varsayilan ?? null;
}

/** İlanda çalacak müziğin kimliği; müziksizse `null`. */
export const ilanMuzikId = (ofis: Pick<OfisGorunumu, "varsayilanMuzikId">, ilan: Pick<IlanSecimi, "muzikSecimi" | "muzikId">) =>
  secilenId(ilan.muzikSecimi, ilan.muzikId, ofis.varsayilanMuzikId);

/** Kapanış arka planı olacak şirket resminin kimliği; yoksa `null` (sahnenin ilan fotoğrafı). */
export const ilanResimId = (ofis: Pick<OfisGorunumu, "varsayilanResimId">, ilan: Pick<IlanSecimi, "resimSecimi" | "resimId">) =>
  secilenId(ilan.resimSecimi ?? "ofis", ilan.resimId, ofis.varsayilanResimId);

/** Videoda gösterilecek şirket logosunun kimliği; yoksa veya "videoda gösterme" seçildiyse `null` (yalnızca şirket adı). */
export const ilanLogoId = (ofis: Pick<OfisGorunumu, "varsayilanLogoId">, ilan: Pick<IlanSecimi, "logoSecimi" | "logoId">) =>
  secilenId(ilan.logoSecimi ?? "ofis", ilan.logoId, ofis.varsayilanLogoId);

/** Bu ofis bu müziği kullanabilir mi: kütüphanedeki veya kendi yüklediği. */
export const muzikKullanilabilir = (m: Pick<MuzikKaydi, "ofisId">, ofisId: string) => m.ofisId === null || m.ofisId === ofisId;

const tarih = (t: Date) => t.toLocaleString("tr-TR", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Istanbul" });

/** `ilan.json`'daki müzik izni: kütüphanede admin'in lisans bilgisi, ofis yüklemesinde ayrıca beyan eden, zaman ve beyan metni. */
export function muzikIzni(m: MuzikKaydi): { lisans: string; beyan?: string } {
  if (m.ofisId === null) return { lisans: `Kliplan müzik kütüphanesi: ${m.lisans}` };
  return { lisans: m.lisans, beyan: `${m.beyanEdenAd ?? "Bilinmeyen kullanıcı"}, ${tarih(m.olusturma)}: "${m.beyan ?? MUZIK_BEYANI}"` };
}

/** Worker'ın klasöre yazdığı dosyaların adları; `ilan.json` bunlara işaret eder. */
export const logoDosyaAdi = (anahtar: string) => `logo${path.extname(anahtar).toLowerCase()}`;
export const muzikDosyaAdi = (anahtar: string) => `muzik${path.extname(anahtar).toLowerCase()}`;
export const KAPANIS_RESMI_DOSYASI = "kapanis.jpg";

/** Kapanış kartındaki şirket satırları, ekrandaki halleriyle. Yalnızca şirketin seçtiği ve dolu olan alanlar. */
export function sirketBilgileri(ofis: Partial<SirketBilgisi>): NonNullable<Ilan["sirketBilgileri"]> | undefined {
  const secili = new Set(ofis.kapanisAlanlari ?? []);
  const yer = [ofis.ilce, ofis.il].filter(Boolean).join("/");
  const degerler: Record<KapanisAlani, string | undefined> = {
    web: ofis.web ?? undefined,
    adres: [ofis.adres, yer].filter(Boolean).join(", ") || undefined,
    yetkili: [ofis.yetkiliAdi, ofis.yetkiliSoyadi].filter(Boolean).join(" ") || undefined,
    eposta: ofis.eposta ?? undefined,
  };
  const sonuc = Object.fromEntries(KAPANIS_ALANLARI.filter((ad) => secili.has(ad) && degerler[ad]).map((ad) => [ad, degerler[ad]]));
  return Object.keys(sonuc).length ? sonuc : undefined;
}

export type GorunumAlanlari = Pick<Ilan, "tema" | "vurguRengi" | "logo" | "muzik" | "kapanisResmi" | "sirketBilgileri">;

/** `ilan.json`'un görünüm alanları. Kayıtlar `ilanMuzikId`, `ilanResimId` ve `ilanLogoId` ile bulunur (yoksa `null`). */
export function gorunumAlanlari(
  ofis: OfisGorunumu,
  ilan: Pick<IlanSecimi, "tema">,
  muzikKaydi: MuzikKaydi | null,
  resimKaydi: ResimKaydi | null = null,
  logoKaydi: Pick<LogoKaydi, "anahtar"> | null = null,
): GorunumAlanlari {
  const bilgiler = sirketBilgileri(ofis);
  return {
    tema: ilanTemasi(ofis, ilan),
    ...(ofis.vurguRengi ? { vurguRengi: ofis.vurguRengi } : {}),
    ...(logoKaydi ? { logo: logoDosyaAdi(logoKaydi.anahtar) } : {}),
    ...(muzikKaydi ? { muzik: { dosya: muzikDosyaAdi(muzikKaydi.anahtar), ...muzikIzni(muzikKaydi) } } : {}),
    ...(resimKaydi ? { kapanisResmi: KAPANIS_RESMI_DOSYASI } : {}),
    ...(bilgiler ? { sirketBilgileri: bilgiler } : {}),
  };
}

export type OfisAyarlari = SirketBilgisi & {
  ad: string;
  telefon: string | null;
  cepTelefonu: string | null;
  yetkiBelgeNo: string | null;
  kapanisAlanlari: KapanisAlani[];
  vurguRengi: string | null;
  tema: TemaAdi;
  varsayilanMuzikId: string | null;
  varsayilanResimId: string | null;
  varsayilanLogoId: string | null;
};
export type AyarSonucu = { basarili: true; veri: OfisAyarlari } | { basarili: false; hatalar: AlanHatalari };

const TELEFON_DESENI = /^0\d{3} \d{3} \d{2} \d{2}$/;
const EPOSTA_DESENI = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const WEB_DESENI = /^[\p{L}\d-]+(\.[\p{L}\d-]+)*\.\p{L}{2,}(\/\S*)?$/u;

/** "https://www.ornek.com/" → "ornek.com". Videoda ve kayıtta protokolsüz tutulur. */
export const webAdresiniTemizle = (deger: string) =>
  deger
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/$/, "")
    .toLocaleLowerCase("tr");

/** Uzunluk sınırları (karakter): kart ve rapor bozulmasın diye. */
const SINIRLAR = { ad: 80, adres: 200, il: 40, ilce: 40, eposta: 120, web: 120, yetkiliAdi: 60, yetkiliSoyadi: 60 } as const;

/**
 * Şirket ayarları formu. Şirket adı zorunlu; diğer bilgiler boş bırakılabilir. Telefon ve yetki belgesi yeni ilan formunu doldurur.
 * Kapanışta gösterilmek üzere seçilen bilgi boşsa kaydedilmez. Vurgu rengi varsayılan temada okunmuyorsa kaydedilmez;
 * diğer temalardaki durum panelde gösterilir. Müzik ve resmin bu şirkete ait olup olmadığını veri katmanı kontrol eder.
 */
export function ofisAyarFormunuDogrula(alanlar: FormAlanlari): AyarSonucu {
  const hatalar: AlanHatalari = {};
  const temiz = (ad: string) => alanlar[ad]?.trim() || null;
  const sinirli = (ad: keyof typeof SINIRLAR) => {
    const deger = temiz(ad);
    if (deger && deger.length > SINIRLAR[ad]) hatalar[ad] = `En fazla ${SINIRLAR[ad]} karakter olabilir.`;
    return deger;
  };
  const telefonAlani = (ad: string) => {
    const deger = telefonuBicimlendir(temiz(ad) ?? undefined) ?? null;
    if (deger && !TELEFON_DESENI.test(deger)) hatalar[ad] = "Telefon '0505 709 44 88' veya '0272 212 00 00' biçiminde olmalı";
    return deger;
  };

  const ad = sinirli("ad");
  if (!ad) hatalar.ad = "Şirket adı boş bırakılamaz.";
  const telefon = telefonAlani("telefon");
  const cepTelefonu = telefonAlani("cepTelefonu");

  const yetkiBelgeNo = temiz("yetkiBelgeNo")?.replace(/\s/g, "") ?? null;
  if (yetkiBelgeNo && !/^\d+$/.test(yetkiBelgeNo)) hatalar.yetkiBelgeNo = "Yetki belge numarası yalnızca rakamlardan oluşmalı";

  const eposta = sinirli("eposta")?.toLocaleLowerCase("tr") ?? null;
  if (eposta && !EPOSTA_DESENI.test(eposta)) hatalar.eposta = "E-posta 'bilgi@ornek.com' biçiminde olmalı";
  const webHam = sinirli("web");
  const web = webHam ? webAdresiniTemizle(webHam) : null;
  if (web && !WEB_DESENI.test(web)) hatalar.web = "Web adresi 'ornekemlak.com' biçiminde olmalı";

  const bilgiler = {
    adres: sinirli("adres"),
    il: sinirli("il"),
    ilce: sinirli("ilce"),
    eposta,
    web,
    yetkiliAdi: sinirli("yetkiliAdi"),
    yetkiliSoyadi: sinirli("yetkiliSoyadi"),
  };

  // Her alan için ayrı kutu: `kapanis.web` vb. İşaretli ama boş bilgi kapanışta gösterilemez.
  const kapanisAlanlari = KAPANIS_ALANLARI.filter((k) => alanlar[`kapanis.${k}`] === "on");
  const dolu: Record<KapanisAlani, boolean> = {
    web: Boolean(web),
    adres: Boolean(bilgiler.adres || bilgiler.il || bilgiler.ilce),
    yetkili: Boolean(bilgiler.yetkiliAdi || bilgiler.yetkiliSoyadi),
    eposta: Boolean(eposta),
  };
  for (const k of kapanisAlanlari) {
    if (!dolu[k]) hatalar[`kapanis.${k}`] = `Kapanışta göstermek için ${KAPANIS_ALANI_ADLARI[k].toLocaleLowerCase("tr")} bilgisini doldurun.`;
  }

  const tema = temiz("tema");
  if (!temaAdiMi(tema)) hatalar.tema = `Tema şunlardan biri olmalı: ${TEMA_ADLARI.join(", ")}`;

  // Renk kutusu her zaman bir değer gönderir; "temanın rengi" seçiliyse yok sayılır.
  const vurguRengi = alanlar.vurguKendi === "on" ? temiz("vurguRengi")?.toUpperCase() ?? null : null;
  if (vurguRengi && !VURGU_DESENI.test(vurguRengi)) hatalar.vurguRengi = "Vurgu rengi '#F2A541' biçiminde olmalı";
  else if (vurguRengi && temaAdiMi(tema)) {
    const hata = vurguHatasi(vurguRengi, tema);
    if (hata) hatalar.vurguRengi = hata;
  }

  if (Object.keys(hatalar).length) return { basarili: false, hatalar };
  return {
    basarili: true,
    veri: {
      ad: ad!,
      telefon,
      cepTelefonu,
      yetkiBelgeNo,
      ...bilgiler,
      kapanisAlanlari,
      vurguRengi,
      tema: tema as TemaAdi,
      varsayilanMuzikId: temiz("varsayilanMuzikId"),
      varsayilanResimId: temiz("varsayilanResimId"),
      varsayilanLogoId: temiz("varsayilanLogoId"),
    },
  };
}
