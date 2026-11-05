import path from "node:path";
import { Worker } from "bullmq";
import { Command } from "commander";
import { config } from "dotenv";
import { veritabaniOlustur } from "../db/baglanti.js";
import { depolamaOlustur } from "../depolama/index.js";
import { senaryoSaglayicisi, sesSaglayicisi } from "../providers/index.js";
import { isiCalistir, isiHataylaKapat, kayitliHata } from "./isler.js";
import { type IsTuru, type IsVerisi, KUYRUK_ADI, redisBaglantisi } from "./kuyruk.js";

config({ quiet: true });

const PROJE_KOKU = path.resolve(import.meta.dirname, "../..");
const zaman = () => new Date().toLocaleTimeString("tr-TR");

const program = new Command()
  .name("worker")
  .description("Web panelinden gelen senaryo ve video işlerini kuyruktan alıp çalıştırır.")
  .option("--mock", "API kullanmadan sahte senaryo ve sessiz sesle test üretimi")
  .action(async (secenekler: { mock?: boolean }) => {
    const db = veritabaniOlustur();
    const baglanti = redisBaglantisi();
    const senaryoSaglayici = senaryoSaglayicisi({ mock: secenekler.mock });
    const sesSaglayici = sesSaglayicisi({ mock: secenekler.mock });
    // .env'de SCRIPT_PROVIDER=mock veya TTS_PROVIDER=mock da sahte üretimdir; bu videolar onaylanamaz.
    const test = !senaryoSaglayici.ucretli || !sesSaglayici.ucretli;
    const baglam = { db, depolama: depolamaOlustur(PROJE_KOKU), senaryoSaglayici, sesSaglayici, onbellekKoku: path.join(PROJE_KOKU, ".cache", "web"), test };

    // Render CPU'yu doldurduğu için aynı anda tek iş çalışır.
    const worker = new Worker<IsVerisi, void, IsTuru>(
      KUYRUK_ADI,
      async (is) => {
        console.log(`[${zaman()}] ▶ ${is.name} işi ${is.data.isId}`);
        await isiCalistir({ ...baglam, gunluk: (m) => console.log(`  ${m}`) }, is.data.isId);
        console.log(`[${zaman()}] ✓ ${is.name} işi tamamlandı`);
      },
      { connection: baglanti, concurrency: 1 },
    );

    // İşleyici hatayı zaten kaydetti; buraya yalnızca worker çöküp iş "takıldı" sayıldığında kayıtsız düşen işler gelir.
    worker.on("failed", (is, hata) => {
      console.error(`[${zaman()}] ✗ ${is?.name ?? "?"} işi başarısız: ${hata.message}`);
      if (is) void isiHataylaKapat(db, is.data.isId, kayitliHata(hata)).catch((e: unknown) => console.error("Hata kaydedilemedi:", e));
    });
    worker.on("error", (hata) => console.error(`[${zaman()}] Kuyruk bağlantı hatası: ${hata.message}`));

    console.log(`Worker çalışıyor${test ? ` (test üretimi: ${senaryoSaglayici.kimlik}, ${sesSaglayici.kimlik})` : ""}. Durdurmak için Ctrl+C.`);

    const kapat = async () => {
      console.log("Kapatılıyor; süren iş bitince çıkılacak…");
      await worker.close();
      await baglanti.quit();
      await db.$client.end();
      process.exit(0);
    };
    process.once("SIGINT", () => void kapat());
    process.once("SIGTERM", () => void kapat());
  });

await program.parseAsync();
