import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { toplamKareSayisi } from "../remotion/hesap.js";
import { tema } from "../remotion/tema.js";
import type { Sahne } from "../remotion/tipler.js";
import type { KelimeZamani, TelaffuzSozlugu, TtsProvider } from "../providers/TtsProvider.js";
import type { YzSenaryo } from "../schema/senaryo.js";
import { type YerTutucu, type YerTutucuDegeri, yerTutuculariDoldur } from "./yerTutucu.js";

/** Sahne başladıktan sonra sesin başlamasına kadar geçen süre. */
export const SES_ONCESI_SN = 0.25;
/** Ses bittikten sonra sahne geçişine kadar bırakılan boşluk. */
const SES_SONRASI_SN = 0.3;
/** Kapanış kartının ses bittikten sonra okunabilmesi için ek süre. */
const KAPANIS_EK_SURE_SN = 2;
/** Süre sesten hesaplanır; bu sınır aşılırsa yalnızca uyarı verilir. */
export const ONERILEN_EN_FAZLA_SURE_SN = 30;

type Tablo = Partial<Record<YerTutucu, YerTutucuDegeri>>;

/** Sahne süresi: ses + boşluklar + geçiş payı. Kare sınırına yukarı yuvarlanır ki ses kesilmesin. */
export function sahneSuresi(sesSuresiSn: number, kapanis: boolean): number {
  const { fps } = tema.video;
  const gecisSn = tema.hareket.gecisKare / fps;
  const ham = SES_ONCESI_SN + sesSuresiSn + SES_SONRASI_SN + (kapanis ? KAPANIS_EK_SURE_SN : gecisSn);
  return Math.ceil(ham * fps) / fps;
}

/** Azure'un kelime zamanları da saklanır; şu an videoda kullanılmıyor. */
type SesKaydi = { uzanti: string; sureSn: number; kelimeler: KelimeZamani[] };

export type SeslendirmeSonucu = {
  sahneler: Sahne[];
  toplamSureSn: number;
  saglayici: string;
  apiCagrisi: number;
  onbellekten: number;
  karakterSayisi: number;
  tahminiMaliyetUsd: number;
};

type SeslendirmeSecenekleri = {
  senaryo: YzSenaryo;
  tablo: Tablo;
  saglayici: TtsProvider;
  sozluk: TelaffuzSozlugu;
  /** Ses dosyaları bu klasörün `ses/` alt klasörüne yazılır; Remotion buradan okur. */
  publicKlasoru: string;
  zorla?: boolean | undefined;
  bildir?: (mesaj: string) => void;
};

async function varMi(yol: string) {
  try {
    await stat(yol);
    return true;
  } catch {
    return false;
  }
}

/** Her sahneyi seslendirir. Aynı metin, ses ve sözlük için önbellekteki dosya kullanılır; API çağrısı yapılmaz. */
export async function sahneleriSeslendir(secenekler: SeslendirmeSecenekleri): Promise<SeslendirmeSonucu> {
  const { senaryo, tablo, saglayici, sozluk, bildir = () => {} } = secenekler;
  const sesKlasoru = path.join(secenekler.publicKlasoru, "ses");
  await mkdir(sesKlasoru, { recursive: true });

  const sonuc: Omit<SeslendirmeSonucu, "toplamSureSn"> = {
    sahneler: [],
    saglayici: saglayici.kimlik,
    apiCagrisi: 0,
    onbellekten: 0,
    karakterSayisi: 0,
    tahminiMaliyetUsd: 0,
  };

  for (const [sira, yz] of senaryo.sahneler.entries()) {
    const metin = yerTutuculariDoldur(yz.disSes, tablo, "ses").replace(/\s+/g, " ").trim();
    const anahtar = createHash("sha256").update(JSON.stringify([saglayici.kimlik, metin, sozluk])).digest("hex").slice(0, 16);
    const kayitYolu = path.join(sesKlasoru, `${anahtar}.json`);

    let kayit: SesKaydi | undefined;
    if (!secenekler.zorla) {
      try {
        const okunan = JSON.parse(await readFile(kayitYolu, "utf8")) as SesKaydi;
        if (await varMi(path.join(sesKlasoru, `${anahtar}.${okunan.uzanti}`))) kayit = okunan;
      } catch {
        // Önbellekte yok.
      }
    }

    if (kayit) {
      sonuc.onbellekten++;
    } else {
      bildir(`  Sahne ${sira + 1} seslendiriliyor (${saglayici.kimlik})…`);
      const yanit = await saglayici.seslendir({ metin, sozluk });
      await writeFile(path.join(sesKlasoru, `${anahtar}.${yanit.uzanti}`), yanit.ses);
      kayit = { uzanti: yanit.uzanti, sureSn: yanit.sureSn, kelimeler: yanit.kelimeler };
      await writeFile(kayitYolu, JSON.stringify(kayit, null, 2));
      sonuc.apiCagrisi++;
      sonuc.karakterSayisi += yanit.karakterSayisi;
      sonuc.tahminiMaliyetUsd += yanit.tahminiMaliyetUsd;
    }

    const kapanis = sira === senaryo.sahneler.length - 1;
    sonuc.sahneler.push({
      fotograf: yz.fotograf,
      baslik: yerTutuculariDoldur(yz.baslik, tablo, "ekran"),
      disSes: metin,
      altyazi: yerTutuculariDoldur(yz.ekranMetni, tablo, "ekran"),
      sureSn: sahneSuresi(kayit.sureSn, kapanis),
      ses: { src: `ses/${anahtar}.${kayit.uzanti}`, baslangicSn: SES_ONCESI_SN },
    });
  }

  return { ...sonuc, toplamSureSn: toplamKareSayisi(sonuc.sahneler) / tema.video.fps };
}
