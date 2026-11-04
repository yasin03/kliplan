import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ScriptProvider } from "../providers/ScriptProvider.js";
import { SaglayiciHatasi } from "../providers/ScriptProvider.js";
import type { TtsProvider } from "../providers/TtsProvider.js";
import type { VideoProps } from "../remotion/tipler.js";
import { ilanKlasorunuDogrula } from "./dogrulama.js";
import { fotograflariHazirla } from "./fotografHazirlama.js";
import type { RaporMaddesi } from "./kontrolRaporu.js";
import type { RenderSonucu, videoyuRenderEt } from "./render.js";
import { ONERILEN_EN_FAZLA_SURE_SN, sahneleriSeslendir } from "./seslendirme.js";
import { SenaryoHatasi, senaryoUret } from "./senaryoUretimi.js";
import { telaffuzSozlugu } from "./telaffuz.js";
import { uretimRaporu } from "./uretimRaporu.js";
import { iletisimBilgisi, videoPropsOlustur } from "./videoProps.js";
import { yerTutucuTablosu } from "./yerTutucu.js";

const REMOTION_KAYNAGI = path.resolve(import.meta.dirname, "../remotion");
/** Kapak, ilk sahnede başlık ve altyazı yerine oturduktan sonraki kare. */
const KAPAK_KARESI = 30;
const ADIM_SAYISI = 6;

/** Hangi adımda ne olduğunu ve nasıl çözüleceğini taşır. */
export class AdimHatasi extends Error {
  constructor(
    readonly adim: string,
    mesaj: string,
    readonly cozum: string,
  ) {
    super(mesaj);
  }
}

export type UretimSecenekleri = {
  klasor: string;
  ciktiKlasoru: string;
  onbellekKlasoru: string;
  senaryoSaglayici: ScriptProvider;
  sesSaglayici: TtsProvider;
  /** Sahte sağlayıcılarla test üretimi; rapora işlenir. */
  test?: boolean | undefined;
  /** Senaryo, ses ve render önbelleklerini yok sayar. */
  zorla?: boolean | undefined;
  /** Testlerde Chrome açmadan akışı denemek için değiştirilebilir. */
  renderEt?: typeof videoyuRenderEt;
  bildir?: (mesaj: string) => void;
  /** Render ilerlemesi (0-1). */
  ilerleme?: (oran: number) => void;
};

export type UretimSonucu = {
  videoYolu: string;
  kapakYolu: string;
  senaryoYolu: string;
  raporYolu: string;
  sureSn: number;
  dosyaBoyutuBayt: number;
  toplamMaliyetUsd: number;
  uyarilar: RaporMaddesi[];
  renderOnbellekten: boolean;
};

async function varMi(yol: string) {
  try {
    await stat(yol);
    return true;
  } catch {
    return false;
  }
}

/** Şablon kodu da özete girer; tasarım değişince video yeniden render edilir. */
async function kaynakOzeti(klasor: string, ozet = createHash("sha256")) {
  for (const girdi of (await readdir(klasor, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const yol = path.join(klasor, girdi.name);
    if (girdi.isDirectory()) await kaynakOzeti(yol, ozet);
    else ozet.update(girdi.name).update(await readFile(yol));
  }
  return ozet;
}

/** Render girdilerinin özeti: video verisi, kullandığı dosyalar ve şablon kodu. */
async function renderOzeti(props: VideoProps, publicKlasoru: string): Promise<string> {
  const ozet = await kaynakOzeti(REMOTION_KAYNAGI);
  ozet.update(JSON.stringify(props));
  const dosyalar = [
    ...Object.values(props.fotograflar).map((f) => f.src),
    ...props.sahneler.flatMap((s) => (s.ses ? [s.ses.src] : [])),
    props.ofis.logo,
    props.muzik,
  ].filter((d): d is string => Boolean(d));
  for (const d of dosyalar) {
    const { size, mtimeMs } = await stat(path.join(publicKlasoru, d));
    ozet.update(`${d}:${size}:${mtimeMs}`);
  }
  return ozet.digest("hex");
}

/** Önce geçici dosyaya yazar, sonra adını değiştirir; yarıda kalan render eski videoyu bozmaz. */
async function guvenliYaz(hedef: string, yaz: (geciciYol: string) => Promise<void>) {
  const { dir, name, ext } = path.parse(hedef);
  const gecici = path.join(dir, `${name}.yarim${ext}`);
  await yaz(gecici);
  await rename(gecici, hedef);
}

async function adim<T>(sira: number, ad: string, cozum: string | ((hata: unknown) => string), is: () => Promise<T>): Promise<T> {
  try {
    return await is();
  } catch (hata) {
    if (hata instanceof AdimHatasi) throw hata;
    const mesaj = hata instanceof Error ? hata.message : String(hata);
    throw new AdimHatasi(`${sira}/${ADIM_SAYISI} ${ad}`, mesaj, typeof cozum === "string" ? cozum : cozum(hata));
  }
}

export async function videoUret(s: UretimSecenekleri): Promise<UretimSonucu> {
  const bildir = s.bildir ?? (() => {});
  const { klasor } = s;
  const publicKlasoru = path.join(s.onbellekKlasoru, "public");
  await mkdir(s.ciktiKlasoru, { recursive: true });

  bildir(`1/${ADIM_SAYISI} İlan doğrulanıyor…`);
  const dogrulama = await adim(1, "Doğrulama", `ilan.json'u ve fotoğrafları düzeltin. Ayrıntılı liste için: npm run dogrula -- ${klasor}`, async () => {
    const { ilan, rapor } = await ilanKlasorunuDogrula(klasor);
    if (!ilan || !rapor.gecerli) throw new Error(rapor.hatalar.map((h) => `${h.alan}: ${h.mesaj}`).join("\n"));
    // Kapanış kartı onaysız bilgiyle kurulamaz; para harcamadan önce burada durulur.
    return { ilan, rapor, iletisim: iletisimBilgisi(ilan) };
  });
  const { ilan } = dogrulama;
  const maddeler: RaporMaddesi[] = [...dogrulama.rapor.maddeler];
  for (const u of dogrulama.rapor.uyarilar) bildir(`  ⚠ ${u.alan}: ${u.mesaj}`);

  bildir(`2/${ADIM_SAYISI} Fotoğraflar hazırlanıyor…`);
  const hazirlik = await adim(2, "Fotoğraflar", "Fotoğraf dosyalarının açılabildiğini kontrol edin; dosya bozuk veya desteklenmeyen biçimde olabilir.", () =>
    fotograflariHazirla(klasor, ilan, publicKlasoru),
  );

  bildir(`3/${ADIM_SAYISI} Senaryo üretiliyor…`);
  const senaryo = await adim(
    3,
    "Senaryo",
    (hata) =>
      hata instanceof SenaryoHatasi
        ? "Komutu yeniden çalıştırın; model farklı bir metin yazabilir. Sürerse ilan bilgilerinin eksiksiz olduğunu kontrol edin."
        : hata instanceof SaglayiciHatasi
          ? ".env'deki API anahtarını ve internet bağlantısını kontrol edin. 429/503 hatasında birkaç dakika sonra tekrar deneyin. API'siz denemek için --mock kullanın."
          : "Hata ayrıntısını kontrol edip komutu yeniden çalıştırın.",
    () => senaryoUret({ ilan, saglayici: s.senaryoSaglayici, onbellekKlasoru: s.onbellekKlasoru, zorla: s.zorla, bildir: (m) => bildir(`  ${m}`) }),
  );

  bildir(`4/${ADIM_SAYISI} Dış ses üretiliyor…`);
  const ses = await adim(
    4,
    "Dış ses",
    ".env'deki AZURE_SPEECH_KEY ve AZURE_SPEECH_REGION değerlerini, telaffuz.json'un geçerli JSON olduğunu kontrol edin. API'siz denemek için --mock kullanın.",
    async () =>
      sahneleriSeslendir({
        senaryo: senaryo.senaryo,
        tablo: yerTutucuTablosu(ilan),
        saglayici: s.sesSaglayici,
        sozluk: await telaffuzSozlugu(ilan),
        publicKlasoru,
        zorla: s.zorla,
        bildir,
      }),
  );
  if (ses.toplamSureSn > ONERILEN_EN_FAZLA_SURE_SN) {
    maddeler.push({
      seviye: "uyari",
      alan: "Süre",
      mesaj: `Video ${ONERILEN_EN_FAZLA_SURE_SN} saniyeden uzun (${ses.toplamSureSn.toFixed(1)} sn). Süre sese göre ayarlandı; bazı platformlarda kırpılabilir.`,
    });
  }

  const videoYolu = path.join(s.ciktiKlasoru, "video.mp4");
  const kapakYolu = path.join(s.ciktiKlasoru, "kapak.jpg");
  bildir(`5/${ADIM_SAYISI} Video render ediliyor…`);
  const render = await adim(
    5,
    "Render",
    "Komutu yeniden çalıştırın; önceki adımlar önbellekten gelir ve para harcanmaz. \"Target closed\" hatası için README'deki Chrome notuna bakın.",
    async () => {
      const props = videoPropsOlustur(ilan, ses.sahneler, hazirlik);
      const ozet = await renderOzeti(props, publicKlasoru);
      const kayitYolu = path.join(s.onbellekKlasoru, "render.json");
      if (!s.zorla && (await varMi(videoYolu)) && (await varMi(kapakYolu))) {
        try {
          const kayit = JSON.parse(await readFile(kayitYolu, "utf8")) as { ozet: string; sonuc: RenderSonucu };
          if (kayit.ozet === ozet) {
            bildir("  Girdiler değişmedi, video yeniden render edilmedi.");
            return { ...kayit.sonuc, onbellekten: true };
          }
        } catch {
          // Kayıt yok; render edilir.
        }
      }

      const renderEt = s.renderEt ?? (await import("./render.js")).videoyuRenderEt;
      let sonuc: RenderSonucu | undefined;
      const { name } = path.parse(kapakYolu);
      const geciciKapak = path.join(s.ciktiKlasoru, `${name}.yarim.jpg`);
      await guvenliYaz(videoYolu, async (geciciVideo) => {
        sonuc = await renderEt({
          props,
          publicKlasoru,
          videoYolu: geciciVideo,
          kareler: [{ kare: KAPAK_KARESI, yol: geciciKapak }],
          ilerleme: (asama, oran) => {
            if (asama === "Video") s.ilerleme?.(oran);
          },
        });
      });
      await rename(geciciKapak, kapakYolu);
      await writeFile(kayitYolu, JSON.stringify({ ozet, sonuc }, null, 2));
      return { ...sonuc!, onbellekten: false };
    },
  );

  bildir(`6/${ADIM_SAYISI} Senaryo ve kontrol raporu yazılıyor…`);
  return adim(6, "Rapor", "Çıktı klasörüne yazma izni olduğunu kontrol edin.", async () => {
    const dosyaBoyutuBayt = (await stat(videoYolu)).size;
    const toplamMaliyetUsd = senaryo.toplamMaliyetUsd + ses.tahminiMaliyetUsd;
    const senaryoYolu = path.join(s.ciktiKlasoru, "senaryo.json");
    await writeFile(
      senaryoYolu,
      JSON.stringify(
        {
          senaryoSaglayici: senaryo.saglayici,
          sesSaglayici: ses.saglayici,
          test: Boolean(s.test),
          onbellektenMi: senaryo.onbellektenMi,
          tahminiMaliyetUsd: { senaryo: senaryo.toplamMaliyetUsd, ses: ses.tahminiMaliyetUsd, toplam: toplamMaliyetUsd },
          kullanilanKritikBilgiler: senaryo.kullanilanYerTutucular,
          denemeler: senaryo.denemeler,
          yzCiktisi: senaryo.senaryo,
          sahneler: ses.sahneler,
        },
        null,
        2,
      ),
    );

    const raporYolu = path.join(s.ciktiKlasoru, "kontrol-raporu.md");
    await writeFile(
      raporYolu,
      uretimRaporu({
        ilan,
        tarih: new Date(),
        test: Boolean(s.test),
        senaryoSaglayici: senaryo.saglayici,
        sesSaglayici: ses.saglayici,
        sahneler: ses.sahneler,
        kullanilanYerTutucular: senaryo.kullanilanYerTutucular,
        iletisim: dogrulama.iletisim,
        maddeler,
        sureSn: render.sureSn,
        dosyaBoyutuBayt,
        maliyet: {
          senaryoUsd: senaryo.toplamMaliyetUsd,
          sesUsd: ses.tahminiMaliyetUsd,
          senaryoOnbellekten: senaryo.onbellektenMi,
          sesApiCagrisi: ses.apiCagrisi,
          sesOnbellekten: ses.onbellekten,
        },
        renderOnbellekten: render.onbellekten,
      }),
    );

    return {
      videoYolu,
      kapakYolu,
      senaryoYolu,
      raporYolu,
      sureSn: render.sureSn,
      dosyaBoyutuBayt,
      toplamMaliyetUsd,
      uyarilar: maddeler.filter((m) => m.seviye === "uyari"),
      renderOnbellekten: render.onbellekten,
    };
  });
}
