import { readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { and, eq, inArray, isNull, lt, ne } from "drizzle-orm";
import type { Veritabani } from "../db/baglanti.js";
import { ilan, ofis, session, user, verification, video } from "../db/sema.js";
import { type Depolama, ilanOneki, ofisOneki } from "../depolama/Depolama.js";

/**
 * Sunucu bakımı: saklama süresi dolan verinin silinmesi ve müşteri ayrılınca ofisin silinmesi.
 * Web paneli bunları kullanmaz; komut satırından (`npm run temizlik`, `ofis-sil`, `kullanici-sil`) ve zamanlanmış görevden çağrılır.
 */

export class BakimHatasi extends Error {}

const GUN_MS = 24 * 60 * 60 * 1000;

export type SaklamaAyarlari = {
  /** Son güncellemeden bu kadar gün sonra ilan, fotoğrafları ve bütün video sürümleriyle silinir. */
  ilanGun: number;
  /** En son sürüm olmayan ve onaylanmamış video sürümleri bu kadar gün sonra silinir. */
  eskiSurumGun: number;
  /** Worker'ın senaryo/ses/fotoğraf önbelleği bu kadar gün dokunulmazsa silinir. */
  onbellekGun: number;
};

export const VARSAYILAN_SAKLAMA: SaklamaAyarlari = { ilanGun: 365, eskiSurumGun: 30, onbellekGun: 30 };

export function saklamaAyarlari(ortam: NodeJS.ProcessEnv = process.env): SaklamaAyarlari {
  const gun = (ad: string, varsayilan: number) => {
    const ham = ortam[ad]?.trim();
    if (!ham) return varsayilan;
    const deger = Number(ham);
    if (!Number.isInteger(deger) || deger < 1) throw new BakimHatasi(`${ad} 1 veya daha büyük bir tam sayı (gün) olmalı: "${ham}"`);
    return deger;
  };
  return {
    ilanGun: gun("SAKLAMA_ILAN_GUN", VARSAYILAN_SAKLAMA.ilanGun),
    eskiSurumGun: gun("SAKLAMA_ESKI_SURUM_GUN", VARSAYILAN_SAKLAMA.eskiSurumGun),
    onbellekGun: gun("SAKLAMA_ONBELLEK_GUN", VARSAYILAN_SAKLAMA.onbellekGun),
  };
}

export type TemizlikPlani = {
  ilanlar: { id: string; ofisId: string; guncelleme: Date }[];
  eskiSurumler: { id: string; ofisId: string; ilanId: string; surum: number }[];
};

/** Silinecekleri listeler, hiçbir şeyi silmez. Üretimi süren ilan atlanır. */
export async function temizlikPlani(db: Veritabani, ayarlar: SaklamaAyarlari, simdi = new Date()): Promise<TemizlikPlani> {
  const ilanSiniri = new Date(simdi.getTime() - ayarlar.ilanGun * GUN_MS);
  const surumSiniri = new Date(simdi.getTime() - ayarlar.eskiSurumGun * GUN_MS);

  const ilanlar = await db
    .select({ id: ilan.id, ofisId: ilan.ofisId, guncelleme: ilan.guncelleme })
    .from(ilan)
    .where(and(lt(ilan.guncelleme, ilanSiniri), ne(ilan.durum, "uretiliyor")));
  const silinecekIlan = new Set(ilanlar.map((i) => i.id));

  // Onaylı sürüm onay kaydıdır, ilanla birlikte silinir; en son sürüm kontrol edilmeyi bekliyor olabilir.
  const adaylar = await db
    .select({ id: video.id, ofisId: video.ofisId, ilanId: video.ilanId, surum: video.surum })
    .from(video)
    .where(and(isNull(video.onayZamani), lt(video.olusturma, surumSiniri)));
  const sonSurumler = new Map<string, number>();
  if (adaylar.length) {
    const tumu = await db
      .select({ ilanId: video.ilanId, surum: video.surum })
      .from(video)
      .where(inArray(video.ilanId, [...new Set(adaylar.map((v) => v.ilanId))]));
    for (const v of tumu) sonSurumler.set(v.ilanId, Math.max(sonSurumler.get(v.ilanId) ?? 0, v.surum));
  }
  const eskiSurumler = adaylar.filter((v) => v.surum < (sonSurumler.get(v.ilanId) ?? 0) && !silinecekIlan.has(v.ilanId));
  return { ilanlar, eskiSurumler };
}

/** Planı uygular: önce kayıt, sonra dosyalar. Dosya silinemezse kayıt zaten gitmiştir; tekrar çalıştırmak zararsızdır. */
export async function temizlikUygula(db: Veritabani, depolama: Depolama, plan: TemizlikPlani, onbellekKoku: string): Promise<void> {
  for (const v of plan.eskiSurumler) {
    await db.delete(video).where(eq(video.id, v.id));
    await depolama.onekSil(`${ilanOneki(v.ofisId, v.ilanId)}video/${v.surum}/`);
  }
  for (const i of plan.ilanlar) {
    await db.delete(ilan).where(eq(ilan.id, i.id));
    await depolama.onekSil(ilanOneki(i.ofisId, i.id));
    await rm(path.join(onbellekKoku, i.id), { recursive: true, force: true });
  }
}

/** Süresi dolan oturum ve doğrulama kayıtları (Better Auth bunları kendisi silmez). */
export async function suresiDolanOturumlariSil(db: Veritabani, simdi = new Date()): Promise<number> {
  const oturumlar = await db.delete(session).where(lt(session.expiresAt, simdi)).returning({ id: session.id });
  await db.delete(verification).where(lt(verification.expiresAt, simdi));
  return oturumlar.length;
}

/**
 * Worker önbelleğinde ilanı silinmiş veya `gun` gündür dokunulmamış klasörleri siler. Önbellek yalnızca para tasarrufu içindir;
 * silinen ilan için tekrar üretimde API yeniden çağrılır.
 */
export async function onbellekTemizle(db: Veritabani, onbellekKoku: string, gun: number, simdi = new Date()): Promise<string[]> {
  let klasorler: string[];
  try {
    klasorler = (await readdir(onbellekKoku, { withFileTypes: true })).filter((g) => g.isDirectory()).map((g) => g.name);
  } catch {
    return [];
  }
  const mevcut = new Set(
    klasorler.length ? (await db.select({ id: ilan.id }).from(ilan).where(inArray(ilan.id, klasorler))).map((i) => i.id) : [],
  );
  const silinen: string[] = [];
  for (const ad of klasorler) {
    const yol = path.join(onbellekKoku, ad);
    const eski = (await stat(yol)).mtimeMs < simdi.getTime() - gun * GUN_MS;
    if (!mevcut.has(ad) || eski) {
      await rm(yol, { recursive: true, force: true });
      silinen.push(ad);
    }
  }
  return silinen;
}

export async function ofisBul(db: Veritabani, ad: string) {
  const kayit = await db.query.ofis.findFirst({ where: eq(ofis.ad, ad.trim()) });
  if (!kayit) throw new BakimHatasi(`"${ad}" adında ofis yok.`);
  const [kullanicilar, ilanlar] = await Promise.all([
    db.query.user.findMany({ where: eq(user.ofisId, kayit.id), columns: { email: true } }),
    db.query.ilan.findMany({ where: eq(ilan.ofisId, kayit.id), columns: { id: true, durum: true } }),
  ]);
  return { ofis: kayit, kullanicilar: kullanicilar.map((k) => k.email), ilanlar };
}

/**
 * Müşteri ayrılınca: ofisin kullanıcılarını (oturumlarıyla), ilanlarını, fotoğraflarını, videolarını, müziklerini, logosunu
 * ve önbelleğini siler. Üretimi süren ilan varsa durur. Yedeklerdeki kopyalar yedek saklama süresi dolunca kendiliğinden gider.
 */
export async function ofisiSil(db: Veritabani, depolama: Depolama, ofisId: string, onbellekKoku: string): Promise<void> {
  const ilanlar = await db.query.ilan.findMany({ where: eq(ilan.ofisId, ofisId), columns: { id: true, durum: true } });
  if (ilanlar.some((i) => i.durum === "uretiliyor")) throw new BakimHatasi("Bu ofiste üretimi süren ilan var. Üretim bitince tekrar deneyin.");
  await db.transaction(async (tx) => {
    // Kullanıcının ofisi "restrict": önce kullanıcılar (oturum ve hesapları onlarla birlikte gider).
    await tx.delete(user).where(eq(user.ofisId, ofisId));
    await tx.delete(ofis).where(eq(ofis.id, ofisId));
  });
  await depolama.onekSil(ofisOneki(ofisId));
  for (const i of ilanlar) await rm(path.join(onbellekKoku, i.id), { recursive: true, force: true });
}

/**
 * Hesabı ve oturumlarını siler. Açtığı ilanlar ofiste kalır ("oluşturan" boşalır); onay ve müzik beyanı kayıtlarında
 * kullanıcı bağlantısı boşalır, beyan edenin adı beyan kaydı olarak kalır.
 */
export async function kullaniciyiSil(db: Veritabani, eposta: string): Promise<void> {
  const silinen = await db.delete(user).where(eq(user.email, eposta.trim().toLowerCase())).returning({ id: user.id });
  if (!silinen.length) throw new BakimHatasi(`${eposta} adresiyle kullanıcı yok.`);
}
