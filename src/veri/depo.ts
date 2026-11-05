import { and, asc, desc, eq, max } from "drizzle-orm";
import type { Veritabani } from "../db/baglanti.js";
import { fotograf, ilan, ofis, video } from "../db/sema.js";
import { anahtariDogrula, type Depolama, ilanOneki } from "../depolama/Depolama.js";
import { EN_FAZLA_FOTOGRAF } from "./fotografIsleme.js";
import { BulunamadiHatasi, dosyayaErisebilirMi, ErisimHatasi, hedefOfis, ofisKosulu, type Yetki } from "./yetki.js";

/** Bağlantılar kısa ömürlü; sayfa yenilendikçe yeniden üretilir. */
export const BAGLANTI_SURESI_SN = 10 * 60;

export type IlanGuncellemesi = Partial<Pick<typeof ilan.$inferInsert, "veri" | "senaryo" | "durum" | "hata">>;
export type YeniFotograf = { dosyaAdi: string; tur: string; icerik: Buffer; icerikTuru: string; genislik: number; yukseklik: number };

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

    /** İlanın ofisi; admin başka ofisin ilanına baktığında ofis adı buradan gelir. */
    async ilanOfisi(ilanId: string) {
      const kayit = await ilanBul(ilanId);
      return (await db.query.ofis.findFirst({ where: eq(ofis.id, kayit.ofisId) }))!;
    },

    async ilanlar() {
      return db.query.ilan.findMany({ where: ofisKosulu(yetki, ilan.ofisId), orderBy: desc(ilan.guncelleme) });
    },

    ilan: ilanBul,

    async ilanOlustur(veri: Record<string, unknown>, ofisId?: string) {
      const [kayit] = await db
        .insert(ilan)
        .values({ ofisId: hedefOfis(yetki, ofisId), olusturanId: yetki.kullaniciId, veri })
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

    /** Formdan gelen bilgileri kaydeder. Senaryo ve durum sıfırlanır, çünkü eski senaryo eski bilgilere göre yazıldı. */
    async ilanBilgileriniKaydet(id: string, veri: Record<string, unknown>) {
      await duzenlenecekIlan(id);
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

    async videolar(ilanId: string) {
      await ilanBul(ilanId);
      return db.query.video.findMany({ where: eq(video.ilanId, ilanId), orderBy: desc(video.surum) });
    },

    /** Yalnızca kendi ofisinin dosyası için kısa ömürlü bağlantı üretir. */
    async dosyaBaglantisi(anahtar: string) {
      if (!dosyayaErisebilirMi(yetki, anahtariDogrula(anahtar))) throw new ErisimHatasi("Bu dosyaya erişim izniniz yok.");
      return depolama.imzaliBaglanti(anahtar, BAGLANTI_SURESI_SN);
    },
  };
}

export type Depo = ReturnType<typeof depoOlustur>;
