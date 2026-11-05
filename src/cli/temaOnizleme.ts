import { mkdir } from "node:fs/promises";
import path from "node:path";
import { Command } from "commander";
import sharp from "sharp";
import { FOTOGRAF_KLASORU } from "../pipeline/dogrulama.js";
import { fotograflariHazirla } from "../pipeline/fotografHazirlama.js";
import { kareleriRenderEt } from "../pipeline/render.js";
import { vurguHatasi } from "../pipeline/renk.js";
import { videoPropsOlustur } from "../pipeline/videoProps.js";
import { sahneKareSayisi, toplamKareSayisi } from "../remotion/hesap.js";
import { TEMA_ADLARI, TEMALAR } from "../remotion/temalar.js";
import type { Sahne } from "../remotion/tipler.js";
import { calistir, ilaniYukle, KomutHatasi, onbellekKlasoru } from "./ortak.js";

/** Kurgusal örnek ilanın sahneleri; önizlemede gerçek müşteri fotoğrafı kullanılmaz. */
const SAHNELER: Sahne[] = [
  { fotograf: "01-bina.jpg", baslik: "Bornova'da 3+1 daire", disSes: "", altyazi: "Asansörlü, kapalı otoparklı bina", sureSn: 3 },
  { fotograf: "02-salon.jpg", baslik: "Geniş ve aydınlık salon", disSes: "", altyazi: "Ebeveyn banyolu, ankastre mutfaklı", sureSn: 3 },
  { fotograf: "06-balkon.jpg", baslik: "Bilgi ve randevu için", disSes: "", altyazi: "Hemen arayın", sureSn: 3 },
];

const program = new Command()
  .name("tema:onizleme")
  .description("Her tema için bir sahne ve kapanış karesi render eder. Paneldeki tema seçiminde bu görseller gösterilir.")
  .argument("[klasor]", "ÖRNEK görselli ilan klasörü", "ilanlar/ornek-bornova")
  .option("--vurgu <renk>", "denenecek vurgu rengi, ör. #2BB673 (varsayılan: her temanın kendi rengi)")
  .option("--cikti <klasor>", "görsellerin yazılacağı klasör", "web/public/temalar")
  .action((klasor: string, s: { vurgu?: string; cikti: string }) =>
    calistir(async () => {
      // En kalabalık hali göstermek için: dört şirket satırı ve kapanışta şirket resmi (yine ÖRNEK görsel).
      const { ilan: yuklenen } = await ilaniYukle(klasor);
      const ilan = {
        ...yuklenen,
        kapanisResmi: `${FOTOGRAF_KLASORU}/03-mutfak.jpg`,
        sirketBilgileri: {
          web: "defneemlak.com.tr",
          adres: "Kazımdirik Mah. 372/5 Sk. No:12, Bornova/İzmir",
          yetkili: "Danışman: Ayşe Yılmaz",
          eposta: "bilgi@defneemlak.com.tr",
        },
      };
      const publicKlasoru = path.join(onbellekKlasoru(klasor), "public");
      const hazirlik = await fotograflariHazirla(klasor, ilan, publicKlasoru);
      const cikti = path.resolve(s.cikti);
      const tamBoy = path.resolve("cikti", "tema-onizleme");
      await mkdir(cikti, { recursive: true });
      await mkdir(tamBoy, { recursive: true });

      // İkinci sahnenin ortası ve kapanış kartının yerine oturduğu an.
      const ikinciSahne = sahneKareSayisi(SAHNELER[0]!) + Math.round(sahneKareSayisi(SAHNELER[1]!) / 2);
      const kapanis = toplamKareSayisi(SAHNELER) - 30;

      for (const temaAdi of TEMA_ADLARI) {
        const hata = vurguHatasi(s.vurgu, temaAdi);
        if (hata) throw new KomutHatasi(hata);
        const props = videoPropsOlustur({ ...ilan, tema: temaAdi, vurguRengi: s.vurgu }, SAHNELER, hazirlik);
        const yollar = [ikinciSahne, kapanis].map((kare) => ({ kare, yol: path.join(tamBoy, `${temaAdi}-${kare}.jpg`) }));
        console.log(`${TEMALAR[temaAdi].ad} tema render ediliyor…`);
        await kareleriRenderEt(props, publicKlasoru, yollar);

        // Panelde küçük gösterilir: iki kare yan yana (548x480).
        const [sol, sag] = await Promise.all(yollar.map(({ yol }) => sharp(yol).resize(270, 480).toBuffer()));
        const hedef = path.join(cikti, `${temaAdi}.jpg`);
        await sharp({ create: { width: 548, height: 480, channels: 3, background: "#FFFFFF" } })
          .composite([
            { input: sol!, left: 0, top: 0 },
            { input: sag!, left: 278, top: 0 },
          ])
          .jpeg({ quality: 82 })
          .toFile(hedef);
        console.log(`  ✓ ${path.relative(process.cwd(), hedef)} · tam boy: ${yollar.map((y) => path.relative(process.cwd(), y.yol)).join(", ")}`);
      }
    }),
  );

await program.parseAsync();
