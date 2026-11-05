import path from "node:path";
import { config } from "dotenv";
import { Command } from "commander";
import { veritabaniOlustur } from "../db/baglanti.js";
import { depolamaOlustur } from "../depolama/index.js";
import { ofisBul, ofisiSil } from "../veri/bakim.js";
import { calistir } from "./ortak.js";

config({ quiet: true });

const PROJE_KOKU = path.resolve(import.meta.dirname, "../..");

const program = new Command()
  .name("ofis-sil")
  .description("Müşteri ayrılınca ofisi bütün verisiyle siler: kullanıcılar, ilanlar, fotoğraflar, videolar, müzikler, logo. --uygula verilmezse yalnızca listeler.")
  .requiredOption("--ofis <ad>", "ofisin adı (kullanici-ekle --ofis ile verilen)")
  .option("--uygula", "gerçekten sil (geri alınamaz)")
  .action((s: { ofis: string; uygula?: boolean }) =>
    calistir(async () => {
      const db = veritabaniOlustur();
      try {
        const { ofis, kullanicilar, ilanlar } = await ofisBul(db, s.ofis);
        console.log(`Ofis: ${ofis.ad} (${ofis.id})`);
        console.log(`- ${kullanicilar.length} kullanıcı: ${kullanicilar.join(", ") || "yok"}`);
        console.log(`- ${ilanlar.length} ilan (fotoğraf, video ve raporlarıyla), ofisin müzikleri ve logosu`);
        if (!s.uygula) {
          console.log(`Hiçbir şey silinmedi. Silmek için: npm run ofis-sil -- --ofis "${ofis.ad}" --uygula`);
          return;
        }
        await ofisiSil(db, depolamaOlustur(PROJE_KOKU), ofis.id, path.join(PROJE_KOKU, ".cache", "web"));
        console.log("✓ Ofis silindi. Veritabanı yedeklerindeki kopyalar yedek saklama süresi (YEDEK_SAKLAMA_GUN) dolunca silinir.");
      } finally {
        await db.$client.end();
      }
    }),
  );

await program.parseAsync();
