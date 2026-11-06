import { and, asc, desc, eq, isNull, max, ne, or } from "drizzle-orm";
import type { Veritabani } from "../db/baglanti.js";
import { fotograf, ilan, type KayitliHata, muzik, ofis, type Secim, sirketLogosu, sirketResmi, uretimIsi, user, video } from "../db/sema.js";
import { anahtariDogrula, type Depolama, ilanOneki, KUTUPHANE_ONEKI, ofisOneki } from "../depolama/Depolama.js";
import type { TemaAdi } from "../remotion/temalar.js";
import { EN_FAZLA_FOTOGRAF, type IslenmisFotograf } from "./fotografIsleme.js";
import { ilanLogoId, ilanMuzikId, ilanResimId, MUZIK_BEYANI, muzikKullanilabilir, type OfisAyarlari } from "./gorunum.js";
import type { IslenmisLogo, IslenmisMuzik } from "./gorunumIsleme.js";
import { BulunamadiHatasi, dosyayaErisebilirMi, ErisimHatasi, hedefOfis, ofisKosulu, type Yetki } from "./yetki.js";

/** Bağlantılar kısa ömürlü; sayfa yenilendikçe yeniden üretilir. */
export const BAGLANTI_SURESI_SN = 10 * 60;

export type IlanGuncellemesi = Partial<Pick<typeof ilan.$inferInsert, "veri" | "senaryo" | "durum" | "hata">>;
export type YeniFotograf = { dosyaAdi: string; tur: string; icerik: Buffer; icerikTuru: string; genislik: number; yukseklik: number };
export type YeniMuzik = {
  ad: string;
  lisans: string;
  /** Hazır kütüphaneye (yalnızca admin) veya ofisin kendi müziklerine. */
  kutuphane: boolean;
  /** Ofis yüklemesinde ticari kullanım beyanı onaylanmış olmalı. */
  beyanOnayi: boolean;
  dosya: IslenmisMuzik;
};
export type IlanGorunumSecimi = {
  tema: TemaAdi | null;
  muzikSecimi: Secim;
  muzikId: string | null;
  /** Verilmezse mevcut kapanış resmi seçimi korunur. */
  resimSecimi?: Secim | undefined;
  resimId?: string | null | undefined;
  /** Verilmezse mevcut logo seçimi korunur. */
  logoSecimi?: Secim | undefined;
  logoId?: string | null | undefined;
};

export const EN_FAZLA_SIRKET_RESMI = 12;
export const EN_FAZLA_SIRKET_LOGOSU = 6;

/** Anahtar sırasından bağımsız JSON; PostgreSQL `jsonb` anahtarları kendi sırasına dizer. */
const siraliJson = (deger: unknown): string =>
  JSON.stringify(deger, (_, d: unknown) =>
    d && typeof d === "object" && !Array.isArray(d) ? Object.fromEntries(Object.entries(d).sort(([x], [y]) => x.localeCompare(y))) : d,
  );

/** Kullanıcının düzeltebileceği durum hataları; mesaj olduğu gibi gösterilir. */
export class DuzenlemeHatasi extends Error {}

/**
 * Web uygulamasının ofise bağlı verilere tek erişim yolu. Her sorgu `Yetki` ile filtrelenir;
 * başka ofisin kaydı "bulunamadı" olarak görünür.
 */
export function depoOlustur(db: Veritabani, yetki: Yetki, depolama: Depolama) {
  async function ilanBul(id: string) {
    const kayit = await db.query.ilan.findFirst({ where: and(eq(ilan.id, id), ofisKosulu(yetki, ilan.ofisId)) });
    if (!kayit) throw new BulunamadiHatasi("İlan bulunamadı.");
    return kayit;
  }

  async function fotografBul(id: string) {
    const kayit = await db.query.fotograf.findFirst({ where: and(eq(fotograf.id, id), ofisKosulu(yetki, fotograf.ofisId)) });
    if (!kayit) throw new BulunamadiHatasi("Fotoğraf bulunamadı.");
    return kayit;
  }

  async function videoBul(id: string) {
    const kayit = await db.query.video.findFirst({ where: and(eq(video.id, id), ofisKosulu(yetki, video.ofisId)) });
    if (!kayit) throw new BulunamadiHatasi("Video bulunamadı.");
    return kayit;
  }

  /** Ayarları düzenlenecek ofis: üye için kendi ofisi, admin için seçtiği ofis. */
  async function ofisKaydi(ofisId?: string) {
    const kayit = await db.query.ofis.findFirst({ where: eq(ofis.id, hedefOfis(yetki, ofisId)) });
    if (!kayit) throw new BulunamadiHatasi("Şirket bulunamadı.");
    return kayit;
  }

  /** Kütüphanedeki müzikleri herkes, ofis yüklemelerini yalnızca o ofis (ve admin) görür. */
  async function muzikBul(id: string) {
    const kosul = yetki.admin ? undefined : or(isNull(muzik.ofisId), ofisKosulu(yetki, muzik.ofisId));
    const kayit = await db.query.muzik.findFirst({ where: and(eq(muzik.id, id), kosul) });
    if (!kayit) throw new BulunamadiHatasi("Müzik bulunamadı.");
    return kayit;
  }

  /** Ofiste kullanılabilecek müzik mi (kütüphane veya kendi yüklemesi)? Değilse kullanıcı hatası. */
  async function secilebilirMuzik(id: string, ofisId: string) {
    const kayit = await db.query.muzik.findFirst({ where: eq(muzik.id, id) });
    if (!kayit || !muzikKullanilabilir(kayit, ofisId)) throw new DuzenlemeHatasi("Seçilen müzik bulunamadı; silinmiş olabilir. Sayfayı yenileyin.");
    return kayit;
  }

  /** Şirketin kendi resmi mi? Değilse kullanıcı hatası. */
  async function secilebilirResim(id: string, ofisId: string) {
    const kayit = await db.query.sirketResmi.findFirst({ where: and(eq(sirketResmi.id, id), eq(sirketResmi.ofisId, ofisId)) });
    if (!kayit) throw new DuzenlemeHatasi("Seçilen şirket resmi bulunamadı; silinmiş olabilir. Sayfayı yenileyin.");
    return kayit;
  }

  /** Şirketin kendi logosu mu? Değilse kullanıcı hatası. */
  async function secilebilirLogo(id: string, ofisId: string) {
    const kayit = await db.query.sirketLogosu.findFirst({ where: and(eq(sirketLogosu.id, id), eq(sirketLogosu.ofisId, ofisId)) });
    if (!kayit) throw new DuzenlemeHatasi("Seçilen logo bulunamadı; silinmiş olabilir. Sayfayı yenileyin.");
    return kayit;
  }

  /**
   * Seçim verilmediyse mevcut korunur; mevcut seçili kayıt silinmişse (kimlik boşaldı) şirket varsayılanına geçilir.
   * "secili" değilse kimlik boşaltılır.
   */
  function korunanSecim(verilen: Secim | undefined, verilenId: string | null | undefined, mevcutSecim: Secim | undefined, mevcutId: string | null | undefined) {
    const korunan = mevcutSecim === "secili" && !mevcutId ? "ofis" : mevcutSecim;
    const secim = verilen ?? korunan ?? "ofis";
    const id = secim === "secili" ? (verilen ? (verilenId ?? null) : (mevcutId ?? null)) : null;
    return { secim, id };
  }

  /** Seçilen müzik, resim ve logo şirkete ait mi. Resim veya logo seçimi verilmezse `mevcut` korunur. */
  async function gorunumSeciminiDogrula(
    secim: IlanGorunumSecimi,
    ofisId: string,
    mevcut?: { resimSecimi: Secim; resimId: string | null; logoSecimi: Secim; logoId: string | null },
  ) {
    const muzikId = secim.muzikSecimi === "secili" ? secim.muzikId : null;
    if (secim.muzikSecimi === "secili") {
      if (!muzikId) throw new DuzenlemeHatasi("Bir müzik seçin.");
      await secilebilirMuzik(muzikId, ofisId);
    }
    const resim = korunanSecim(secim.resimSecimi, secim.resimId, mevcut?.resimSecimi, mevcut?.resimId);
    if (resim.secim === "secili") {
      if (!resim.id) throw new DuzenlemeHatasi("Bir şirket resmi seçin.");
      await secilebilirResim(resim.id, ofisId);
    }
    const logo = korunanSecim(secim.logoSecimi, secim.logoId, mevcut?.logoSecimi, mevcut?.logoId);
    if (logo.secim === "secili") {
      if (!logo.id) throw new DuzenlemeHatasi("Bir logo seçin.");
      await secilebilirLogo(logo.id, ofisId);
    }
    return {
      tema: secim.tema,
      muzikSecimi: secim.muzikSecimi,
      muzikId,
      resimSecimi: resim.secim,
      resimId: resim.id,
      logoSecimi: logo.secim,
      logoId: logo.id,
    };
  }

  /** Bilgi veya fotoğraf değişecekse çağrılır. Üretim sürerken değişikliğe izin verilmez. */
  async function duzenlenecekIlan(id: string) {
    const kayit = await ilanBul(id);
    if (kayit.durum === "uretiliyor") throw new DuzenlemeHatasi("Video üretilirken ilan değiştirilemez. Üretim bitince tekrar deneyin.");
    return kayit;
  }

  /** İçerik değişince eski senaryo ve video geçerliliğini yitirir; ilan yeniden taslak olur. */
  async function taslagaDondur(ilanId: string) {
    await db.update(ilan).set({ durum: "taslak", hata: null }).where(eq(ilan.id, ilanId));
  }

  return {
    async ofis() {
      if (!yetki.ofisId) return null;
      return (await db.query.ofis.findFirst({ where: eq(ofis.id, yetki.ofisId) })) ?? null;
    },

    /** Kayıt oluştururken seçilebilecek ofisler: admin için hepsi, üye için yalnızca kendi ofisi. */
    async ofisler() {
      return db.query.ofis.findMany({ where: ofisKosulu(yetki, ofis.id), columns: { id: true, ad: true }, orderBy: asc(ofis.ad) });
    },

    ayarlanacakOfis: ofisKaydi,

    /**
     * Şirket bilgileri ve görünüm varsayılanları; verilen alanlar güncellenir. Yalnızca bundan sonra üretilen videolara uygulanır.
     * Ad başka bir şirkette varsa kaydedilmez (`kullanici-ekle --ofis` şirketi adıyla bulur). Ad değiştiyse eski ad döner:
     * kayıtlı senaryolar eski adı içerir, panel uyarır.
     */
    async ofisAyarlariniKaydet(ayarlar: Partial<OfisAyarlari>, ofisId?: string): Promise<{ eskiAd: string | null }> {
      const kayit = await ofisKaydi(ofisId);
      if (ayarlar.varsayilanMuzikId) await secilebilirMuzik(ayarlar.varsayilanMuzikId, kayit.id);
      if (ayarlar.varsayilanResimId) await secilebilirResim(ayarlar.varsayilanResimId, kayit.id);
      if (ayarlar.varsayilanLogoId) await secilebilirLogo(ayarlar.varsayilanLogoId, kayit.id);
      const adDegisti = ayarlar.ad !== undefined && ayarlar.ad !== kayit.ad;
      if (adDegisti && (await db.query.ofis.findFirst({ where: and(eq(ofis.ad, ayarlar.ad!), ne(ofis.id, kayit.id)), columns: { id: true } }))) {
        throw new DuzenlemeHatasi(`"${ayarlar.ad}" adıyla başka bir şirket kayıtlı. Farklı bir ad yazın.`);
      }
      await db.update(ofis).set(ayarlar).where(eq(ofis.id, kayit.id));
      return { eskiAd: adDegisti ? kayit.ad : null };
    },

    /** Şirketin resimleri, yüklenme sırasıyla. Admin ofis belirtmeli. */
    async resimler(ofisId?: string) {
      const hedef = hedefOfis(yetki, ofisId);
      return db.query.sirketResmi.findMany({ where: eq(sirketResmi.ofisId, hedef), orderBy: asc(sirketResmi.olusturma) });
    },

    /** Resmi yazar ve kaydeder; kayıt başarısız olursa dosya silinir. En fazla `EN_FAZLA_SIRKET_RESMI`. */
    async resimEkle(resim: Pick<IslenmisFotograf, "dosyaAdi" | "icerik" | "icerikTuru" | "genislik" | "yukseklik">, ofisId?: string) {
      const hedef = hedefOfis(yetki, ofisId);
      if ((await db.$count(sirketResmi, eq(sirketResmi.ofisId, hedef))) >= EN_FAZLA_SIRKET_RESMI) {
        throw new DuzenlemeHatasi(`En fazla ${EN_FAZLA_SIRKET_RESMI} şirket resmi yüklenebilir. Yenisi için birini silin.`);
      }
      const anahtar = anahtariDogrula(`${ofisOneki(hedef)}resim/${resim.dosyaAdi}`);
      await depolama.yaz(anahtar, resim.icerik, resim.icerikTuru);
      try {
        const [kayit] = await db.insert(sirketResmi).values({ ofisId: hedef, anahtar, genislik: resim.genislik, yukseklik: resim.yukseklik }).returning();
        return kayit!;
      } catch (hata) {
        await depolama.sil(anahtar);
        throw hata;
      }
    },

    /** Kullanan ilanlar şirketin varsayılanına, varsayılan olarak seçen şirket "resim yok"a döner. Üretilmiş videolar değişmez. */
    async resimSil(id: string) {
      const kayit = await db.query.sirketResmi.findFirst({ where: and(eq(sirketResmi.id, id), ofisKosulu(yetki, sirketResmi.ofisId)) });
      if (!kayit) throw new BulunamadiHatasi("Resim bulunamadı.");
      await db.delete(sirketResmi).where(eq(sirketResmi.id, kayit.id));
      await depolama.sil(kayit.anahtar);
    },

    /** İlanın kapanış arka planı olacak resim (ilanın seçimi veya şirketin varsayılanı); yoksa `null`. */
    async ilanResmi(ilanId: string) {
      const kayit = await ilanBul(ilanId);
      const sahip = (await db.query.ofis.findFirst({ where: eq(ofis.id, kayit.ofisId) }))!;
      const id = ilanResimId(sahip, kayit);
      if (!id) return null;
      return (await db.query.sirketResmi.findFirst({ where: and(eq(sirketResmi.id, id), eq(sirketResmi.ofisId, kayit.ofisId)) })) ?? null;
    },

    /** Şirketin logoları, yüklenme sırasıyla. Admin ofis belirtmeli. */
    async logolar(ofisId?: string) {
      const hedef = hedefOfis(yetki, ofisId);
      return db.query.sirketLogosu.findMany({ where: eq(sirketLogosu.ofisId, hedef), orderBy: asc(sirketLogosu.olusturma) });
    },

    /** Logoyu yazar ve kaydeder; şirketin ilk logosu varsayılan olur. En fazla `EN_FAZLA_SIRKET_LOGOSU`. */
    async logoEkle(logo: Pick<IslenmisLogo, "dosyaAdi" | "icerik" | "icerikTuru">, ofisId?: string) {
      const sahip = await ofisKaydi(ofisId);
      if ((await db.$count(sirketLogosu, eq(sirketLogosu.ofisId, sahip.id))) >= EN_FAZLA_SIRKET_LOGOSU) {
        throw new DuzenlemeHatasi(`En fazla ${EN_FAZLA_SIRKET_LOGOSU} logo yüklenebilir. Yenisi için birini silin.`);
      }
      const anahtar = anahtariDogrula(`${ofisOneki(sahip.id)}logo/${logo.dosyaAdi}`);
      await depolama.yaz(anahtar, logo.icerik, logo.icerikTuru);
      try {
        const [kayit] = await db.insert(sirketLogosu).values({ ofisId: sahip.id, anahtar }).returning();
        if (!sahip.varsayilanLogoId) await db.update(ofis).set({ varsayilanLogoId: kayit!.id }).where(eq(ofis.id, sahip.id));
        return kayit!;
      } catch (hata) {
        await depolama.sil(anahtar);
        throw hata;
      }
    },

    /** Kullanan ilanlar şirketin varsayılanına, varsayılan olarak seçen şirket "logo yok"a döner. Üretilmiş videolar değişmez. */
    async logoSil(id: string) {
      const kayit = await db.query.sirketLogosu.findFirst({ where: and(eq(sirketLogosu.id, id), ofisKosulu(yetki, sirketLogosu.ofisId)) });
      if (!kayit) throw new BulunamadiHatasi("Logo bulunamadı.");
      await db.delete(sirketLogosu).where(eq(sirketLogosu.id, kayit.id));
      await depolama.sil(kayit.anahtar);
    },

    /** İlanda gösterilecek logo (ilanın seçimi veya şirketin varsayılanı); yoksa `null`. */
    async ilanLogosu(ilanId: string) {
      const kayit = await ilanBul(ilanId);
      const sahip = (await db.query.ofis.findFirst({ where: eq(ofis.id, kayit.ofisId) }))!;
      const id = ilanLogoId(sahip, kayit);
      if (!id) return null;
      return (await db.query.sirketLogosu.findFirst({ where: and(eq(sirketLogosu.id, id), eq(sirketLogosu.ofisId, kayit.ofisId)) })) ?? null;
    },

    /**
     * Seçilebilecek müzikler: kütüphane ve ofisin kendi yüklemeleri. Admin ofis belirtmezse bütün ofislerin yüklemelerini de görür.
     * Kütüphane önce gelir.
     */
    async muzikler(ofisId?: string) {
      const hedef = yetki.admin && !ofisId ? null : hedefOfis(yetki, ofisId);
      const kosul = hedef ? or(isNull(muzik.ofisId), eq(muzik.ofisId, hedef)) : undefined;
      const liste = await db.query.muzik.findMany({ where: kosul, orderBy: [asc(muzik.ad), asc(muzik.olusturma)] });
      return liste.sort((x, y) => Number(x.ofisId !== null) - Number(y.ofisId !== null));
    },

    muzik: muzikBul,

    /** Kütüphaneye yalnızca admin ekler. Ofis yüklemesinde beyan metni, beyan eden ve zaman saklanır. */
    async muzikEkle(yeni: YeniMuzik, ofisId?: string) {
      const ad = yeni.ad.trim();
      const lisans = yeni.lisans.trim();
      if (!ad || ad.length > 80) throw new DuzenlemeHatasi("Müziğe 80 karakteri geçmeyen bir ad verin.");
      if (!lisans || lisans.length > 500) throw new DuzenlemeHatasi("Lisans bilgisini yazın (lisans adı, satın alma bağlantısı veya sözleşme no; en fazla 500 karakter).");

      let hedef: string | null = null;
      let beyan: { beyan: string; beyanEdenId: string; beyanEdenAd: string } | null = null;
      if (yeni.kutuphane) {
        if (!yetki.admin) throw new ErisimHatasi("Kütüphaneye yalnızca yönetici müzik ekleyebilir.");
      } else {
        hedef = hedefOfis(yetki, ofisId);
        if (!yeni.beyanOnayi) throw new DuzenlemeHatasi("Yüklemek için ticari kullanım beyanını onaylayın.");
        const kullanici = await db.query.user.findFirst({ where: eq(user.id, yetki.kullaniciId), columns: { name: true } });
        beyan = { beyan: MUZIK_BEYANI, beyanEdenId: yetki.kullaniciId, beyanEdenAd: kullanici?.name ?? yetki.kullaniciId };
      }

      const anahtar = anahtariDogrula(`${hedef ? ofisOneki(hedef) : KUTUPHANE_ONEKI}muzik/${yeni.dosya.dosyaAdi}`);
      await depolama.yaz(anahtar, yeni.dosya.icerik, yeni.dosya.icerikTuru);
      try {
        const [kayit] = await db
          .insert(muzik)
          .values({
            ofisId: hedef,
            ad,
            lisans,
            anahtar,
            icerikTuru: yeni.dosya.icerikTuru,
            sureSn: yeni.dosya.sureSn,
            boyutBayt: yeni.dosya.icerik.length,
            ...beyan,
          })
          .returning();
        return kayit!;
      } catch (hata) {
        await depolama.sil(anahtar);
        throw hata;
      }
    },

    /**
     * Kütüphane müziğini yalnızca admin, ofis müziğini o ofis siler. Kullanan ilanlar ofisin varsayılanına,
     * varsayılan olarak seçen ofisler müziksize döner. Üretilmiş videolar değişmez.
     */
    async muzikSil(id: string) {
      const kayit = await muzikBul(id);
      if (kayit.ofisId === null && !yetki.admin) throw new ErisimHatasi("Kütüphanedeki müziği yalnızca yönetici silebilir.");
      await db.delete(muzik).where(eq(muzik.id, kayit.id));
      await depolama.sil(kayit.anahtar);
    },

    /** Dinleme bağlantısı. */
    async muzikBaglantisi(id: string) {
      return depolama.imzaliBaglanti((await muzikBul(id)).anahtar, BAGLANTI_SURESI_SN);
    },

    /** İlanda çalacak müzik (ilanın seçimi veya ofisin varsayılanı); müziksizse `null`. */
    async ilanMuzigi(ilanId: string) {
      const kayit = await ilanBul(ilanId);
      const sahip = (await db.query.ofis.findFirst({ where: eq(ofis.id, kayit.ofisId) }))!;
      const id = ilanMuzikId(sahip, kayit);
      if (!id) return null;
      const m = await db.query.muzik.findFirst({ where: eq(muzik.id, id) });
      return m && muzikKullanilabilir(m, kayit.ofisId) ? m : null;
    },

    /** İlanın teması, müziği, kapanış resmi ve logosu. Değişirse eski video geçerliliğini yitirir ve ilan taslağa döner; senaryo korunur. */
    async ilanGorunumunuKaydet(ilanId: string, secim: IlanGorunumSecimi) {
      const kayit = await duzenlenecekIlan(ilanId);
      const yeni = await gorunumSeciminiDogrula(secim, kayit.ofisId, kayit);
      if ((Object.keys(yeni) as (keyof typeof yeni)[]).every((k) => kayit[k] === yeni[k])) return;
      await db.update(ilan).set({ ...yeni, durum: "taslak", hata: null }).where(eq(ilan.id, ilanId));
    },

    /** İlanın ofisi; admin başka ofisin ilanına baktığında ofis adı buradan gelir. */
    async ilanOfisi(ilanId: string) {
      const kayit = await ilanBul(ilanId);
      return (await db.query.ofis.findFirst({ where: eq(ofis.id, kayit.ofisId) }))!;
    },

    async ilanlar() {
      return db.query.ilan.findMany({ where: ofisKosulu(yetki, ilan.ofisId), orderBy: desc(ilan.guncelleme) });
    },

    ilan: ilanBul,

    /** Yeni ilan; görünüm seçimi verilmezse şirketin varsayılanları kullanılır. */
    async ilanOlustur(veri: Record<string, unknown>, ofisId?: string, gorunum?: IlanGorunumSecimi) {
      const hedef = hedefOfis(yetki, ofisId);
      const secim = gorunum ? await gorunumSeciminiDogrula(gorunum, hedef) : {};
      const [kayit] = await db
        .insert(ilan)
        .values({ ofisId: hedef, olusturanId: yetki.kullaniciId, veri, ...secim })
        .returning();
      return kayit!;
    },

    async ilanGuncelle(id: string, degisiklik: IlanGuncellemesi) {
      const [kayit] = await db
        .update(ilan)
        .set(degisiklik)
        .where(and(eq(ilan.id, id), ofisKosulu(yetki, ilan.ofisId)))
        .returning();
      if (!kayit) throw new BulunamadiHatasi("İlan bulunamadı.");
      return kayit;
    },

    /**
     * Formdan gelen bilgileri kaydeder. Bilgiler değiştiyse senaryo ve durum sıfırlanır, çünkü eski senaryo eski bilgilere göre yazıldı.
     * Değişmediyse (ör. form yalnızca görünüm için kaydedildi) senaryoya dokunulmaz.
     */
    async ilanBilgileriniKaydet(id: string, veri: Record<string, unknown>) {
      const mevcut = await duzenlenecekIlan(id);
      if (siraliJson(mevcut.veri) === siraliJson(veri)) return mevcut;
      const [kayit] = await db.update(ilan).set({ veri, senaryo: null, durum: "taslak", hata: null }).where(eq(ilan.id, id)).returning();
      return kayit!;
    },

    /** Kaydı ve depodaki bütün dosyalarını (fotoğraf, video, rapor) siler. */
    async ilanSil(id: string) {
      const kayit = await ilanBul(id);
      await db.delete(ilan).where(eq(ilan.id, kayit.id));
      await depolama.onekSil(ilanOneki(kayit.ofisId, kayit.id));
    },

    async fotograflar(ilanId: string) {
      await ilanBul(ilanId);
      return db.query.fotograf.findMany({ where: eq(fotograf.ilanId, ilanId), orderBy: [asc(fotograf.sira), asc(fotograf.olusturma)] });
    },

    /** Dosyayı depoya yazar ve listenin sonuna ekler. Kayıt başarısız olursa yazılan dosya silinir. */
    async fotografEkle(ilanId: string, yeni: YeniFotograf) {
      const kayit = await duzenlenecekIlan(ilanId);
      if ((await db.$count(fotograf, eq(fotograf.ilanId, ilanId))) >= EN_FAZLA_FOTOGRAF) {
        throw new DuzenlemeHatasi(`Bir ilana en fazla ${EN_FAZLA_FOTOGRAF} fotoğraf eklenebilir.`);
      }
      const anahtar = anahtariDogrula(`${ilanOneki(kayit.ofisId, kayit.id)}fotograf/${yeni.dosyaAdi}`);
      await depolama.yaz(anahtar, yeni.icerik, yeni.icerikTuru);
      try {
        const [son] = await db
          .select({ sira: max(fotograf.sira) })
          .from(fotograf)
          .where(eq(fotograf.ilanId, ilanId));
        const [eklenen] = await db
          .insert(fotograf)
          .values({
            ofisId: kayit.ofisId,
            ilanId,
            sira: (son?.sira ?? -1) + 1,
            dosyaAdi: yeni.dosyaAdi,
            tur: yeni.tur,
            anahtar,
            genislik: yeni.genislik,
            yukseklik: yeni.yukseklik,
          })
          .returning();
        await taslagaDondur(ilanId);
        return eklenen!;
      } catch (hata) {
        await depolama.sil(anahtar);
        throw hata;
      }
    },

    async fotografTuruDegistir(id: string, tur: string) {
      const kayit = await fotografBul(id);
      await duzenlenecekIlan(kayit.ilanId);
      await db.update(fotograf).set({ tur }).where(eq(fotograf.id, id));
      await taslagaDondur(kayit.ilanId);
    },

    async fotografSil(id: string) {
      const kayit = await fotografBul(id);
      await duzenlenecekIlan(kayit.ilanId);
      await db.delete(fotograf).where(eq(fotograf.id, id));
      await depolama.sil(kayit.anahtar);
      await taslagaDondur(kayit.ilanId);
    },

    /** `siralama` ilanın bütün fotoğraf kimliklerini yeni sırasıyla içermeli; eksik veya fazla kimlik reddedilir. */
    async fotograflariSirala(ilanId: string, siralama: string[]) {
      await duzenlenecekIlan(ilanId);
      const mevcut = await db.query.fotograf.findMany({ where: eq(fotograf.ilanId, ilanId), columns: { id: true } });
      const beklenen = new Set(mevcut.map((f) => f.id));
      if (siralama.length !== beklenen.size || new Set(siralama).size !== beklenen.size || !siralama.every((id) => beklenen.has(id))) {
        throw new DuzenlemeHatasi("Fotoğraf listesi değişmiş. Sayfayı yenileyip tekrar deneyin.");
      }
      await db.transaction(async (tx) => {
        for (const [sira, id] of siralama.entries()) {
          await tx
            .update(fotograf)
            .set({ sira })
            .where(and(eq(fotograf.id, id), eq(fotograf.ilanId, ilanId)));
        }
      });
      await taslagaDondur(ilanId);
    },

    /** Senaryo düzenleme ekranından; doğrulama çağıran tarafta (`duzenlenenSenaryo`) yapılır. Eski video geçerliliğini yitirir. */
    async senaryoKaydet(ilanId: string, senaryo: unknown) {
      await duzenlenecekIlan(ilanId);
      await db.update(ilan).set({ senaryo, durum: "taslak", hata: null }).where(eq(ilan.id, ilanId));
    },

    /**
     * Üretim işini kaydeder ve ilanı "üretiliyor" yapar. Aynı ilanda ikinci bir iş başlatılamaz;
     * kontrol ve kilit tek sorguda yapıldığı için iki sekmeden aynı anda basılsa da tek iş açılır.
     * Kuyruğa ekleme çağıranın işi; eklenemezse `isBasarisiz` çağrılmalı.
     */
    async uretimBaslat(ilanId: string, tur: "senaryo" | "video", zorla = false) {
      const kayit = await ilanBul(ilanId);
      if (tur === "video" && !kayit.senaryo) throw new DuzenlemeHatasi("Önce senaryoyu üretin.");
      return db.transaction(async (tx) => {
        const [kilit] = await tx
          .update(ilan)
          .set({ durum: "uretiliyor", hata: null })
          .where(and(eq(ilan.id, ilanId), ne(ilan.durum, "uretiliyor")))
          .returning({ id: ilan.id });
        if (!kilit) throw new DuzenlemeHatasi("Bu ilan için üretim zaten sürüyor.");
        const [is] = await tx.insert(uretimIsi).values({ ofisId: kayit.ofisId, ilanId, tur, zorla }).returning();
        return is!;
      });
    },

    /** Kuyruğa eklenemeyen işi hata olarak kapatır; ilan "hata" durumuna geçer ve yeniden denenebilir. */
    async isBasarisiz(isId: string, hata: KayitliHata) {
      const is = await db.query.uretimIsi.findFirst({ where: and(eq(uretimIsi.id, isId), ofisKosulu(yetki, uretimIsi.ofisId)) });
      if (!is) throw new BulunamadiHatasi("İş bulunamadı.");
      await db.update(uretimIsi).set({ durum: "hata", hata, bitis: new Date() }).where(eq(uretimIsi.id, isId));
      await db.update(ilan).set({ durum: "hata", hata }).where(eq(ilan.id, is.ilanId));
    },

    /** İlanın en son işi: durum, adım ve ilerleme panelde bundan gösterilir. */
    async sonIs(ilanId: string) {
      await ilanBul(ilanId);
      return (await db.query.uretimIsi.findFirst({ where: eq(uretimIsi.ilanId, ilanId), orderBy: desc(uretimIsi.olusturma) })) ?? null;
    },

    async videolar(ilanId: string) {
      await ilanBul(ilanId);
      return db.query.video.findMany({ where: eq(video.ilanId, ilanId), orderBy: desc(video.surum) });
    },

    /**
     * Son sürümü onaylar ve ilanı "onaylandı" yapar. Kontrol listesinin tam olduğunu çağıran doğrular
     * (`kontrolMaddeleri`); burada işaretlenen maddelerin metni onay kaydı olarak saklanır.
     */
    async videoOnayla(videoId: string, kontrolListesi: string[]) {
      const kayit = await videoBul(videoId);
      if (kayit.test) throw new DuzenlemeHatasi("Test üretimi (sahte ses ve metin) onaylanamaz. Videoyu gerçek sağlayıcılarla yeniden üretin.");
      if (kayit.onayZamani) throw new DuzenlemeHatasi("Bu video zaten onaylandı.");
      const [son] = await db.query.video.findMany({ where: eq(video.ilanId, kayit.ilanId), orderBy: desc(video.surum), limit: 1, columns: { id: true } });
      if (son?.id !== kayit.id) throw new DuzenlemeHatasi("Yalnızca en son sürüm onaylanabilir.");
      await db.transaction(async (tx) => {
        const [ilanKaydi] = await tx
          .update(ilan)
          .set({ durum: "onaylandi" })
          .where(and(eq(ilan.id, kayit.ilanId), eq(ilan.durum, "kontrol_bekliyor")))
          .returning({ id: ilan.id });
        if (!ilanKaydi) throw new DuzenlemeHatasi("İlan onaya hazır değil; bilgiler değişmiş veya üretim sürüyor olabilir. Sayfayı yenileyin.");
        await tx.update(video).set({ kontrolListesi, onaylayanId: yetki.kullaniciId, onayZamani: new Date() }).where(eq(video.id, kayit.id));
      });
    },

    /**
     * İndirme bağlantısı. Video ve kapak yalnızca onaydan sonra indirilir (onaysız videonun yanlışlıkla
     * gönderilmesini önlemek için); kontrol raporu her zaman.
     */
    async videoIndirmeBaglantisi(videoId: string, dosya: "video" | "kapak" | "rapor") {
      const kayit = await videoBul(videoId);
      if (dosya !== "rapor" && !kayit.onayZamani) throw new ErisimHatasi("Video onaylanmadan indirilemez. Önce kontrol listesini tamamlayıp onaylayın.");
      const { anahtar, uzanti } = {
        video: { anahtar: kayit.videoAnahtari, uzanti: "mp4" },
        kapak: { anahtar: kayit.kapakAnahtari, uzanti: "jpg" },
        rapor: { anahtar: kayit.raporAnahtari, uzanti: "md" },
      }[dosya];
      const ad = `kliplan-${dosya === "rapor" ? "kontrol-raporu" : dosya}-s${kayit.surum}.${uzanti}`;
      return depolama.imzaliBaglanti(anahtar, BAGLANTI_SURESI_SN, ad);
    },

    /** Yalnızca kendi ofisinin dosyası için kısa ömürlü bağlantı üretir. */
    async dosyaBaglantisi(anahtar: string) {
      if (!dosyayaErisebilirMi(yetki, anahtariDogrula(anahtar))) throw new ErisimHatasi("Bu dosyaya erişim izniniz yok.");
      return depolama.imzaliBaglanti(anahtar, BAGLANTI_SURESI_SN);
    },
  };
}

export type Depo = ReturnType<typeof depoOlustur>;
