import { config } from "dotenv";
import { Command } from "commander";
import { s3Ayarlari } from "../depolama/index.js";
import { s3Istemcisi } from "../depolama/S3Depolama.js";
import { eskiYedekleriSil, yedekIndir, yedekleriListele, yedekYukle } from "../depolama/yedek.js";
import { calistir, KomutHatasi } from "./ortak.js";

config({ quiet: true });

/** Varsayılan 30 gün; silinen müşteri verisi yedeklerden de en geç bu sürede düşer. */
function saklamaGunu(): number {
  const ham = process.env.YEDEK_SAKLAMA_GUN?.trim() || "30";
  const gun = Number(ham);
  if (!Number.isInteger(gun) || gun < 1) throw new KomutHatasi(`YEDEK_SAKLAMA_GUN 1 veya daha büyük bir tam sayı olmalı: "${ham}"`);
  return gun;
}

const baglanti = () => {
  const ayarlar = s3Ayarlari(process.env, "YEDEK_S3_");
  return { istemci: s3Istemcisi(ayarlar), bucket: ayarlar.bucket };
};

const program = new Command()
  .name("yedek")
  .description("Veritabanı yedeklerini yedek bucket'ına (YEDEK_S3_*) yükler, listeler ve geri yükleme için indirir. Döküm `deploy/yedekle.sh` ile alınır.");

program
  .command("yukle")
  .argument("<dosya>", "pg_dump -Fc ile alınmış döküm")
  .description("Dökümü yükler ve saklama süresi (YEDEK_SAKLAMA_GUN) dolan yedekleri siler")
  .action((dosya: string) =>
    calistir(async () => {
      const { istemci, bucket } = baglanti();
      const anahtar = await yedekYukle(istemci, bucket, dosya);
      console.log(`✓ Yüklendi: ${anahtar}`);
      const gun = saklamaGunu();
      const silinen = await eskiYedekleriSil(istemci, bucket, gun);
      console.log(`  ${gun} günden eski ${silinen.length} yedek silindi.${silinen.length ? ` (${silinen.join(", ")})` : ""}`);
    }),
  );

program
  .command("listele")
  .description("Yedekleri yeniden eskiye listeler")
  .action(() =>
    calistir(async () => {
      const { istemci, bucket } = baglanti();
      for (const y of await yedekleriListele(istemci, bucket)) {
        console.log(`${y.tarih.toISOString()}  ${(y.boyutBayt / 1024 / 1024).toFixed(1).padStart(7)} MB  ${y.anahtar}`);
      }
    }),
  );

program
  .command("indir")
  .argument("<anahtar>", "listede görünen anahtar, ör. postgres/kliplan-20261105T033000Z.dump")
  .argument("<hedef>", "kaydedilecek dosya")
  .description("Geri yükleme için bir yedeği indirir")
  .action((anahtar: string, hedef: string) =>
    calistir(async () => {
      const { istemci, bucket } = baglanti();
      await yedekIndir(istemci, bucket, anahtar, hedef);
      console.log(`✓ İndirildi: ${hedef}`);
    }),
  );

await program.parseAsync();
