import { config } from "dotenv";
import { Command } from "commander";
import { veritabaniOlustur } from "../db/baglanti.js";
import { kullaniciyiSil } from "../veri/bakim.js";
import { calistir } from "./ortak.js";

config({ quiet: true });

const program = new Command()
  .name("kullanici-sil")
  .description("Hesabı ve oturumlarını siler. Açtığı ilanlar ofiste kalır; müzik beyanlarında beyan edenin adı kayıt olarak kalır.")
  .requiredOption("--eposta <eposta>", "giriş e-postası")
  .action((s: { eposta: string }) =>
    calistir(async () => {
      const db = veritabaniOlustur();
      try {
        await kullaniciyiSil(db, s.eposta);
        console.log(`✓ Hesap silindi: ${s.eposta}`);
      } finally {
        await db.$client.end();
      }
    }),
  );

await program.parseAsync();
