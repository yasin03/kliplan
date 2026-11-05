import { config } from "dotenv";
import { Command } from "commander";
import { veritabaniOlustur } from "../db/baglanti.js";
import { kimlikOlustur } from "../kimlik/auth.js";
import { kullaniciEkle } from "../kimlik/kullanici.js";
import { calistir } from "./ortak.js";

config({ quiet: true });

const program = new Command()
  .name("kullanici-ekle")
  .description("Web paneline giriş yapacak bir hesap açar. Açık kayıt kapalı olduğu için hesaplar yalnızca bu komutla açılır.")
  .requiredOption("--eposta <eposta>", "giriş e-postası")
  .requiredOption("--ad <ad>", "kullanıcının adı soyadı")
  .option("--ofis <ad>", "emlak ofisinin adı; yoksa oluşturulur")
  .option("--admin", "tüm ofisleri gören yönetici hesabı")
  .option("--sifre <sifre>", "verilmezse rastgele üretilir")
  .action((s: { eposta: string; ad: string; ofis?: string; admin?: boolean; sifre?: string }) =>
    calistir(async () => {
      const db = veritabaniOlustur();
      try {
        const sonuc = await kullaniciEkle(db, kimlikOlustur(db), {
          eposta: s.eposta,
          ad: s.ad,
          ofisAdi: s.ofis,
          admin: s.admin,
          sifre: s.sifre,
        });
        console.log(`✓ Hesap açıldı: ${sonuc.eposta}${s.admin ? " (admin)" : ` · ofis: ${s.ofis}`}`);
        if (sonuc.sifreUretildi) {
          console.log(`  Şifre: ${sonuc.sifre}`);
          console.log("  Bu şifre bir daha gösterilmez. Kullanıcıya güvenli bir kanaldan iletin.");
        }
      } finally {
        await db.$client.end();
      }
    }),
  );

await program.parseAsync();
