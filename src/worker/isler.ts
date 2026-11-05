import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { asc, eq, max } from "drizzle-orm";
import type { Veritabani } from "../db/baglanti.js";
import { fotograf, ilan, type KayitliHata, ofis, uretimIsi, video } from "../db/sema.js";
import { anahtariDogrula, type Depolama, ilanOneki } from "../depolama/Depolama.js";
import { FOTOGRAF_KLASORU, ILAN_DOSYASI } from "../pipeline/dogrulama.js";
import type { videoyuRenderEt } from "../pipeline/render.js";
import { duzenlenenSenaryo, SenaryoHatasi, type SenaryoSonucu } from "../pipeline/senaryoUretimi.js";
import { AdimHatasi, ilanHazirla, senaryoAsamasi, videoAsamasi } from "../pipeline/uretim.js";
import type { ScriptProvider } from "../providers/ScriptProvider.js";
import type { TtsProvider } from "../providers/TtsProvider.js";
import { ilanJsonuOlustur } from "../veri/ilanFormu.js";

export type IsBaglami = {
  db: Veritabani;
  depolama: Depolama;
  senaryoSaglayici: ScriptProvider;
  sesSaglayici: TtsProvider;
  /** Senaryo ve ses önbelleği ilan başına `<kok>/<ilanId>` altında; kaybolursa yalnızca API yeniden çağrılır. */
  onbellekKoku: string;
  /** Sahte sağlayıcılarla çalışılıyorsa raporda "test üretimi" yazar. */
  test: boolean;
  renderEt?: typeof videoyuRenderEt;
  /** Worker günlüğü. */
  gunluk?: (mesaj: string) => void;
};

/**
 * Panelde gösterilecek çözüm. Pipeline'ın kendi çözüm metinleri CLI içindir (".env", "--mock");
 * emlakçıya ne yapacağı söylenir, teknik ayrıntı `mesaj`da kalır.
 */
function panelCozumu(adim: string): string {
  const sira = Number(adim.split("/")[0]);
  switch (sira) {
    case 1:
      return "İlan bilgilerini ve fotoğrafları kontrol edip düzeltin, sonra yeniden deneyin.";
    case 2:
      return "Fotoğraflardan biri açılamadı. Fotoğrafları kontrol edin; gerekirse silip yeniden yükleyin.";
    case 3:
      return "Yeniden deneyin; yapay zeka farklı bir metin yazabilir. Sürerse senaryoyu elle düzenleyin veya yöneticiye haber verin.";
    case 4:
    case 5:
      return "Yeniden deneyin; tamamlanan adımlar tekrar ücretlendirilmez. Sürerse yöneticiye haber verin.";
    default:
      return "Yeniden deneyin. Sürerse yöneticiye haber verin.";
  }
}

export function kayitliHata(hata: unknown): KayitliHata {
  if (hata instanceof AdimHatasi) return { adim: hata.adim, mesaj: hata.message, cozum: panelCozumu(hata.adim) };
  return {
    adim: "Üretim",
    mesaj: hata instanceof Error ? hata.message : String(hata),
    cozum: "Yeniden deneyin. Sürerse yöneticiye haber verin.",
  };
}

/** İşi ve ilanı hata durumuna alır. Worker'ın "failed" olayından da çağrılır (ör. iş yarıda kaldıysa); iki kez çağrılması zararsızdır. */
export async function isiHataylaKapat(db: Veritabani, isId: string, hata: KayitliHata): Promise<void> {
  const is = await db.query.uretimIsi.findFirst({ where: eq(uretimIsi.id, isId) });
  if (!is || is.durum === "hata" || is.durum === "tamamlandi") return;
  await db.transaction(async (tx) => {
    await tx.update(uretimIsi).set({ durum: "hata", hata, bitis: new Date(), ilerleme: null }).where(eq(uretimIsi.id, isId));
    await tx.update(ilan).set({ durum: "hata", hata }).where(eq(ilan.id, is.ilanId));
  });
}

/** Veritabanındaki ilanı pipeline'ın okuduğu klasör yapısına çevirir: `ilan.json` + `fotograflar/`. */
async function ilanKlasoruKur(b: IsBaglami, ilanId: string, klasor: string) {
  const kayit = await b.db.query.ilan.findFirst({ where: eq(ilan.id, ilanId) });
  if (!kayit) throw new AdimHatasi("1/6 Doğrulama", "İlan bulunamadı; silinmiş olabilir.", "");
  const ofisKaydi = (await b.db.query.ofis.findFirst({ where: eq(ofis.id, kayit.ofisId) }))!;
  const fotograflar = await b.db.query.fotograf.findMany({ where: eq(fotograf.ilanId, ilanId), orderBy: [asc(fotograf.sira), asc(fotograf.olusturma)] });

  const json = ilanJsonuOlustur(kayit.veri, ofisKaydi, fotograflar);
  if (!json.basarili) throw new AdimHatasi("1/6 Doğrulama", json.hatalar.join("\n"), "");

  await mkdir(path.join(klasor, FOTOGRAF_KLASORU), { recursive: true });
  await writeFile(path.join(klasor, ILAN_DOSYASI), JSON.stringify(json.ilan, null, 2));
  for (const f of fotograflar) await writeFile(path.join(klasor, FOTOGRAF_KLASORU, f.dosyaAdi), await b.depolama.oku(f.anahtar));
  return kayit;
}

const CIKTI_DOSYALARI = [
  ["video.mp4", "video/mp4"],
  ["kapak.jpg", "image/jpeg"],
  ["kontrol-raporu.md", "text/markdown; charset=utf-8"],
  ["senaryo.json", "application/json"],
] as const;

/**
 * Kuyruktan gelen işi çalıştırır. Senaryo işi ilana senaryoyu yazar ve taslağa döndürür;
 * video işi çıktıları depoya yükler, yeni bir video sürümü açar ve ilanı "kontrol bekliyor" yapar.
 * Hata kaydedilir ve yeniden fırlatılır (BullMQ işi başarısız sayar).
 */
export async function isiCalistir(b: IsBaglami, isId: string): Promise<void> {
  const { db } = b;
  const gunluk = b.gunluk ?? (() => {});
  const is = await db.query.uretimIsi.findFirst({ where: eq(uretimIsi.id, isId) });
  // İlan silindiyse iş de silinmiştir; tamamlanmış iş (ör. kuyruğa iki kez düşen) tekrar çalışmaz.
  if (!is || is.durum === "tamamlandi") return;

  await db.update(uretimIsi).set({ durum: "calisiyor", baslangic: new Date(), asama: null, ilerleme: null, hata: null }).where(eq(uretimIsi.id, isId));
  const durumYaz = (degisiklik: { asama?: string; ilerleme?: number }) =>
    db
      .update(uretimIsi)
      .set(degisiklik)
      .where(eq(uretimIsi.id, isId))
      .catch((e: unknown) => gunluk(`İlerleme yazılamadı: ${String(e)}`));
  const bildir = (mesaj: string) => {
    gunluk(mesaj);
    // Girintili satırlar ayrıntı; panelde yalnızca ana adım görünür.
    if (!mesaj.startsWith(" ")) void durumYaz({ asama: mesaj });
  };
  let sonYuzde = -1;
  const ilerleme = (oran: number) => {
    const yuzde = Math.floor(oran * 20) * 5;
    if (yuzde === sonYuzde) return;
    sonYuzde = yuzde;
    void durumYaz({ ilerleme: yuzde / 100 });
  };

  const gecici = await mkdtemp(path.join(tmpdir(), "kliplan-is-"));
  const klasor = path.join(gecici, "ilan");
  const ciktiKlasoru = path.join(gecici, "cikti");
  const onbellekKlasoru = path.join(b.onbellekKoku, is.ilanId);

  try {
    const kayit = await ilanKlasoruKur(b, is.ilanId, klasor);
    const hazir = await ilanHazirla({ klasor, onbellekKlasoru, bildir });

    if (is.tur === "senaryo") {
      const senaryo = await senaryoAsamasi({ senaryoSaglayici: b.senaryoSaglayici, onbellekKlasoru, zorla: is.zorla, bildir }, hazir);
      await db.transaction(async (tx) => {
        await tx.update(ilan).set({ senaryo, durum: "taslak", hata: null }).where(eq(ilan.id, is.ilanId));
        await tx
          .update(uretimIsi)
          .set({ durum: "tamamlandi", maliyetUsd: senaryo.toplamMaliyetUsd, bitis: new Date(), asama: null })
          .where(eq(uretimIsi.id, isId));
      });
      return;
    }

    // Kayıtlı senaryo her seferinde yeniden denetlenir: kurallar veya ilan bilgileri değişmiş olabilir.
    const kayitli = kayit.senaryo as SenaryoSonucu | null;
    if (!kayitli) throw new AdimHatasi("3/6 Senaryo", "Bu ilan için kayıtlı senaryo yok.", "");
    let senaryo: SenaryoSonucu;
    try {
      senaryo = duzenlenenSenaryo(kayitli, hazir.ilan, kayitli.senaryo);
    } catch (hata) {
      if (hata instanceof SenaryoHatasi) throw new AdimHatasi("3/6 Senaryo", hata.message, "");
      throw hata;
    }

    const sonuc = await videoAsamasi(
      {
        ciktiKlasoru,
        onbellekKlasoru,
        sesSaglayici: b.sesSaglayici,
        test: b.test,
        zorla: is.zorla,
        bildir,
        ilerleme,
        ...(b.renderEt ? { renderEt: b.renderEt } : {}),
      },
      hazir,
      senaryo,
    );

    const [son] = await db.select({ surum: max(video.surum) }).from(video).where(eq(video.ilanId, is.ilanId));
    const surum = (son?.surum ?? 0) + 1;
    const onek = `${ilanOneki(kayit.ofisId, kayit.id)}video/${surum}/`;
    const anahtarlar: Record<string, string> = {};
    for (const [dosya, tur] of CIKTI_DOSYALARI) {
      const anahtar = anahtariDogrula(`${onek}${dosya}`);
      await b.depolama.yaz(anahtar, await readFile(path.join(ciktiKlasoru, dosya)), tur);
      anahtarlar[dosya] = anahtar;
    }

    try {
      await db.transaction(async (tx) => {
        await tx.insert(video).values({
          ofisId: kayit.ofisId,
          ilanId: kayit.id,
          surum,
          videoAnahtari: anahtarlar["video.mp4"]!,
          kapakAnahtari: anahtarlar["kapak.jpg"]!,
          raporAnahtari: anahtarlar["kontrol-raporu.md"]!,
          senaryoAnahtari: anahtarlar["senaryo.json"]!,
          sureSn: sonuc.sureSn,
          boyutBayt: sonuc.dosyaBoyutuBayt,
          maliyetUsd: sonuc.toplamMaliyetUsd,
          test: b.test,
        });
        await tx.update(ilan).set({ durum: "kontrol_bekliyor", hata: null }).where(eq(ilan.id, kayit.id));
        await tx
          .update(uretimIsi)
          .set({ durum: "tamamlandi", maliyetUsd: sonuc.toplamMaliyetUsd, bitis: new Date(), asama: null, ilerleme: null })
          .where(eq(uretimIsi.id, isId));
      });
    } catch (hata) {
      // Kayıt açılamadıysa (ör. ilan bu sırada silindi) yüklenen dosyalar sahipsiz kalmasın.
      await b.depolama.onekSil(onek);
      throw hata;
    }
  } catch (hata) {
    await isiHataylaKapat(db, isId, kayitliHata(hata));
    throw hata;
  } finally {
    await rm(gecici, { recursive: true, force: true });
  }
}
