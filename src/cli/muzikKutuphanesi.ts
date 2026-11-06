import { readFile } from "node:fs/promises";
import path from "node:path";
import { config } from "dotenv";
import { Command } from "commander";
import { z } from "zod";
import { veritabaniOlustur } from "../db/baglanti.js";
import { depolamaOlustur } from "../depolama/index.js";
import { depoOlustur } from "../veri/depo.js";
import { muzigiIsle } from "../veri/gorunumIsleme.js";
import { calistir, KomutHatasi } from "./ortak.js";

config({ quiet: true });

const PROJE_KOKU = path.resolve(import.meta.dirname, "../..");

/** Klasördeki `muzikler.json`: her müziğin dosyası, paneldeki adı ve ticari kullanım izninin kaynağı. */
const listeSemasi = z.array(
  z.strictObject({
    dosya: z.string().regex(/^[^/\\]+\.(mp3|m4a|wav)$/i, { error: "Dosya .mp3, .m4a veya .wav olmalı ve klasör yolu içermemeli" }),
    ad: z.string().trim().min(1).max(80),
    /** Ör. "CC0 1.0 · <parça sayfası>" veya "Pixabay Content License · <parça sayfası>". Kontrol raporuna yazılır. */
    lisans: z.string().trim().min(1).max(500),
  }),
);

const program = new Command()
  .name("muzik:kutuphane")
  .description("Bir klasördeki müzikleri, muzikler.json'daki ad ve lisans bilgisiyle hazır kütüphaneye ekler (bütün şirketler görür). Aynı adlı müzik atlanır.")
  .argument("<klasor>", "müzik dosyaları ve muzikler.json")
  .action((klasor: string) =>
    calistir(async () => {
      const ham = JSON.parse(await readFile(path.join(klasor, "muzikler.json"), "utf8")) as unknown;
      const sonuc = listeSemasi.safeParse(ham);
      if (!sonuc.success) throw new KomutHatasi(`muzikler.json hatalı: ${sonuc.error.issues.map((s) => `${s.path.join(".")}: ${s.message}`).join("; ")}`);

      const db = veritabaniOlustur();
      try {
        // Kütüphaneye yalnızca admin ekler; komutu sunucuya erişen yönetici çalıştırır.
        const admin = await db.query.user.findFirst({ where: (u, { eq }) => eq(u.rol, "admin"), columns: { id: true } });
        if (!admin) throw new KomutHatasi("Yönetici hesabı yok. Önce `npm run kullanici-ekle -- --admin` ile açın.");
        const depo = depoOlustur(db, { kullaniciId: admin.id, ofisId: null, admin: true }, depolamaOlustur(PROJE_KOKU));
        const mevcut = new Set((await depo.muzikler()).filter((m) => m.ofisId === null).map((m) => m.ad));

        for (const m of sonuc.data) {
          if (mevcut.has(m.ad)) {
            console.log(`  – ${m.ad}: kütüphanede var, atlandı`);
            continue;
          }
          const dosya = await muzigiIsle(await readFile(path.join(klasor, m.dosya)));
          await depo.muzikEkle({ ad: m.ad, lisans: m.lisans, kutuphane: true, beyanOnayi: false, dosya });
          console.log(`  ✓ ${m.ad} (${dosya.sureSn.toFixed(0)} sn)`);
        }
      } finally {
        await db.$client.end();
      }
    }),
  );

await program.parseAsync();
