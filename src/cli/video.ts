import { config } from "dotenv";
import path from "node:path";
import { Command } from "commander";
import { videoUret } from "../pipeline/uretim.js";
import { senaryoSaglayicisi, sesSaglayicisi } from "../providers/index.js";
import { calistir, ilanAdi, onbellekKlasoru } from "./ortak.js";

config({ quiet: true });

const goreli = (yol: string) => path.relative(process.cwd(), yol);

const program = new Command()
  .name("video")
  .description("İlan klasöründen tek komutla video, kapak, senaryo ve kontrol raporu üretir.")
  .argument("<klasor>", "ilan klasörü, ör. ilanlar/temurlar")
  .option("--mock", "API kullanmadan sahte senaryo ve sessiz sesle test üretimi")
  .option("--force", "senaryo, ses ve render önbelleklerini yok say")
  .action((klasor: string, secenekler: { mock?: boolean; force?: boolean }) =>
    calistir(async () => {
      const ciktiKlasoru = path.resolve("cikti", ilanAdi(klasor));
      if (secenekler.mock) console.log("ℹ Test üretimi (--mock): API kullanılmıyor, ses sessiz.\n");

      let sonYuzde = -1;
      const senaryoSaglayici = senaryoSaglayicisi({ mock: secenekler.mock });
      const sesSaglayici = sesSaglayicisi({ mock: secenekler.mock });
      const sonuc = await videoUret({
        klasor,
        ciktiKlasoru,
        onbellekKlasoru: onbellekKlasoru(klasor),
        senaryoSaglayici,
        sesSaglayici,
        // .env'de sahte sağlayıcı seçilmişse de rapora "test üretimi" yazılır.
        test: !senaryoSaglayici.ucretli || !sesSaglayici.ucretli,
        zorla: secenekler.force,
        bildir: (m) => console.log(m),
        ilerleme: (oran) => {
          const yuzde = Math.floor(oran * 4) * 25;
          if (yuzde === sonYuzde) return;
          sonYuzde = yuzde;
          console.log(`  Render: %${yuzde}`);
        },
      });

      console.log(`\n✓ ${secenekler.mock ? "Test videosu" : "Video"} hazır: ${goreli(ciktiKlasoru)}/`);
      console.log(`  video.mp4          ${sonuc.sureSn.toFixed(1)} sn · ${(sonuc.dosyaBoyutuBayt / 1024 / 1024).toFixed(1)} MB`);
      console.log("  kapak.jpg");
      console.log("  senaryo.json");
      console.log("  kontrol-raporu.md");
      console.log(`  Tahmini API maliyeti: ~$${sonuc.toplamMaliyetUsd.toFixed(4)}`);
      if (sonuc.uyarilar.length > 0) console.log(`  ⚠ ${sonuc.uyarilar.length} uyarı var; kontrol raporunda listelendi.`);
      console.log("\nGöndermeden önce videoyu izleyin ve kontrol-raporu.md'deki listeyi tamamlayın.");
    }),
  );

await program.parseAsync();
