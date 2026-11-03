import { config } from "dotenv";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Command } from "commander";
import { senaryoUret } from "../pipeline/senaryoUretimi.js";
import { senaryoSaglayicisi } from "../providers/index.js";
import { calistir, ilaniYukle, ilanAdi, onbellekKlasoru } from "./ortak.js";

config({ quiet: true });

const program = new Command()
  .name("senaryo")
  .description("İlan verisinden yapay zeka ile sahne metni üretir, kurallara göre doğrular ve senaryo.json olarak kaydeder.")
  .argument("<klasor>", "ilan klasörü, ör. ilanlar/temurlar")
  .option("--mock", "API kullanmadan sahte sağlayıcıyla üret")
  .option("--force", "önbelleği yok say ve yeniden üret")
  .action((klasor: string, secenekler: { mock?: boolean; force?: boolean }) =>
    calistir(async () => {
      const { ilan } = await ilaniYukle(klasor);
      const saglayici = senaryoSaglayicisi({ mock: secenekler.mock });

      const sonuc = await senaryoUret({
        ilan,
        saglayici,
        onbellekKlasoru: onbellekKlasoru(klasor),
        zorla: secenekler.force,
        bildir: (m) => console.log(m),
      });

      const ciktiYolu = path.resolve("cikti", ilanAdi(klasor), "senaryo.json");
      await mkdir(path.dirname(ciktiYolu), { recursive: true });
      await writeFile(
        ciktiYolu,
        JSON.stringify(
          {
            saglayici: sonuc.saglayici,
            onbellektenMi: sonuc.onbellektenMi,
            tahminiMaliyetUsd: sonuc.toplamMaliyetUsd,
            kullanilanKritikBilgiler: sonuc.kullanilanYerTutucular,
            denemeler: sonuc.denemeler,
            yzCiktisi: sonuc.senaryo,
            sahneler: sonuc.sahneler,
          },
          null,
          2,
        ),
      );

      console.log("");
      for (const [i, s] of sonuc.sahneler.entries()) {
        console.log(`${i + 1}. [${s.fotograf}, ${s.sureSn} sn] ${s.baslik}`);
        console.log(`   Ses:     ${s.disSes}`);
        console.log(`   Altyazı: ${s.altyazi}`);
      }
      const maliyet = saglayici.ucretli && !sonuc.onbellektenMi ? `~$${sonuc.toplamMaliyetUsd.toFixed(4)}` : "$0 (API çağrısı yok)";
      console.log(`\n✓ Senaryo kaydedildi: ${path.relative(process.cwd(), ciktiYolu)}`);
      console.log(`  Deneme: ${sonuc.denemeler.length || "önbellek"} · Tahmini API maliyeti: ${maliyet}`);
      console.log(`  Videoyu görmek için: npm run render:ornek -- ${klasor} --senaryo ${path.relative(process.cwd(), ciktiYolu)}`);
    }),
  );

await program.parseAsync();
