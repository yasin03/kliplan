import path from "node:path";
import { config } from "dotenv";
import { Command } from "commander";
import { veritabaniOlustur } from "../db/baglanti.js";
import { depolamaOlustur } from "../depolama/index.js";
import { onbellekTemizle, saklamaAyarlari, suresiDolanOturumlariSil, temizlikPlani, temizlikUygula } from "../veri/bakim.js";
import { calistir } from "./ortak.js";

config({ quiet: true });

const PROJE_KOKU = path.resolve(import.meta.dirname, "../..");

const program = new Command()
  .name("temizlik")
  .description(
    "Saklama süresi dolan verileri siler: eski ilanlar (SAKLAMA_ILAN_GUN), eski onaysız video sürümleri (SAKLAMA_ESKI_SURUM_GUN), " +
      "worker önbelleği (SAKLAMA_ONBELLEK_GUN) ve süresi dolan oturumlar. --uygula verilmezse yalnızca listeler.",
  )
  .option("--uygula", "listelenenleri gerçekten sil")
  .action((s: { uygula?: boolean }) =>
    calistir(async () => {
      const ayarlar = saklamaAyarlari();
      const db = veritabaniOlustur();
      try {
        const plan = await temizlikPlani(db, ayarlar);
        console.log(`Saklama: ilan ${ayarlar.ilanGun} gün, eski sürüm ${ayarlar.eskiSurumGun} gün, önbellek ${ayarlar.onbellekGun} gün.`);
        console.log(`- ${plan.ilanlar.length} ilan ${ayarlar.ilanGun} gündür güncellenmedi:`);
        for (const i of plan.ilanlar) console.log(`    ${i.id} (ofis ${i.ofisId}, son güncelleme ${i.guncelleme.toISOString().slice(0, 10)})`);
        console.log(`- ${plan.eskiSurumler.length} eski, onaysız video sürümü.`);
        if (!s.uygula) {
          console.log("Hiçbir şey silinmedi. Silmek için: npm run temizlik -- --uygula");
          return;
        }
        const onbellekKoku = path.join(PROJE_KOKU, ".cache", "web");
        await temizlikUygula(db, depolamaOlustur(PROJE_KOKU), plan, onbellekKoku);
        const oturum = await suresiDolanOturumlariSil(db);
        const onbellek = await onbellekTemizle(db, onbellekKoku, ayarlar.onbellekGun);
        console.log(`✓ Silindi: ${plan.ilanlar.length} ilan, ${plan.eskiSurumler.length} video sürümü, ${oturum} oturum, ${onbellek.length} önbellek klasörü.`);
      } finally {
        await db.$client.end();
      }
    }),
  );

await program.parseAsync();
