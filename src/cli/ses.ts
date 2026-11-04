import { config } from "dotenv";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Command } from "commander";
import { ONERILEN_EN_FAZLA_SURE_SN, sahneleriSeslendir } from "../pipeline/seslendirme.js";
import { senaryoyuDogrula } from "../pipeline/senaryoDogrulama.js";
import { telaffuzSozlugu } from "../pipeline/telaffuz.js";
import { yerTutucuTablosu } from "../pipeline/yerTutucu.js";
import { sesSaglayicisi } from "../providers/index.js";
import { calistir, ilaniYukle, ilanAdi, KomutHatasi, onbellekKlasoru } from "./ortak.js";

config({ quiet: true });

const usd = (deger: number) => `~$${deger.toFixed(4)}`;

const program = new Command()
  .name("ses")
  .description("Senaryodaki her sahneyi seslendirir, sahne sürelerini sesten hesaplar ve zamanlı altyazıyı kurar.")
  .argument("<klasor>", "ilan klasörü, ör. ilanlar/temurlar")
  .option("--senaryo <dosya>", "senaryo dosyası (varsayılan: cikti/<ilan>/senaryo.json)")
  .option("--mock", "API kullanmadan sessiz sahte sesle üret")
  .option("--force", "ses önbelleğini yok say ve yeniden üret")
  .action((klasor: string, secenekler: { senaryo?: string; mock?: boolean; force?: boolean }) =>
    calistir(async () => {
      console.log("1/2 İlan ve senaryo okunuyor…");
      const { ilan } = await ilaniYukle(klasor);
      const senaryoYolu = path.resolve(secenekler.senaryo ?? path.join("cikti", ilanAdi(klasor), "senaryo.json"));

      let kayit: { yzCiktisi?: unknown; tahminiMaliyetUsd?: number; onbellektenMi?: boolean };
      try {
        kayit = JSON.parse(await readFile(senaryoYolu, "utf8")) as typeof kayit;
      } catch {
        throw new KomutHatasi(`Senaryo dosyası okunamadı: ${senaryoYolu}\nÖnce şunu çalıştırın: npm run senaryo -- ${klasor}`);
      }
      const tablo = yerTutucuTablosu(ilan);
      const dogrulama = senaryoyuDogrula(kayit.yzCiktisi, { ilan, tablo });
      if (!dogrulama.senaryo) {
        throw new KomutHatasi(
          `Senaryo güncel kurallara uymuyor, yeniden üretin (npm run senaryo -- ${klasor} --force):\n` +
            dogrulama.hatalar.map((h) => `  - ${h}`).join("\n"),
        );
      }

      const saglayici = sesSaglayicisi({ mock: secenekler.mock });
      console.log(`2/2 Sahneler seslendiriliyor (${saglayici.kimlik})…`);
      const sonuc = await sahneleriSeslendir({
        senaryo: dogrulama.senaryo,
        tablo,
        saglayici,
        sozluk: await telaffuzSozlugu(ilan),
        publicKlasoru: path.join(onbellekKlasoru(klasor), "public"),
        zorla: secenekler.force,
        bildir: (m) => console.log(m),
      });

      const ciktiYolu = path.join(path.dirname(senaryoYolu), "sesli-senaryo.json");
      await mkdir(path.dirname(ciktiYolu), { recursive: true });
      await writeFile(
        ciktiYolu,
        JSON.stringify(
          {
            sesSaglayici: sonuc.saglayici,
            toplamSureSn: sonuc.toplamSureSn,
            ses: {
              apiCagrisi: sonuc.apiCagrisi,
              onbellekten: sonuc.onbellekten,
              karakterSayisi: sonuc.karakterSayisi,
              tahminiMaliyetUsd: sonuc.tahminiMaliyetUsd,
            },
            sahneler: sonuc.sahneler,
          },
          null,
          2,
        ),
      );

      console.log("");
      for (const [i, s] of sonuc.sahneler.entries()) {
        console.log(`${i + 1}. [${s.fotograf}, ${s.sureSn.toFixed(2)} sn] ${s.baslik}`);
        console.log(`   ${s.altyazi}`);
      }

      const senaryoMaliyeti = kayit.onbellektenMi ? 0 : (kayit.tahminiMaliyetUsd ?? 0);
      console.log(`\n✓ Sesli senaryo kaydedildi: ${path.relative(process.cwd(), ciktiYolu)}`);
      console.log(`  Video süresi: ${sonuc.toplamSureSn.toFixed(1)} sn`);
      console.log(
        `  Ses: ${sonuc.apiCagrisi} API çağrısı, ${sonuc.onbellekten} sahne önbellekten, ${sonuc.karakterSayisi} karakter · ` +
          (saglayici.ucretli ? usd(sonuc.tahminiMaliyetUsd) : "$0 (sahte ses)"),
      );
      console.log(`  Senaryo (senaryo.json'dan): ${usd(senaryoMaliyeti)}`);
      console.log(`  Toplam tahmini API maliyeti: ${usd(senaryoMaliyeti + sonuc.tahminiMaliyetUsd)}`);
      if (saglayici.ucretli && sonuc.apiCagrisi > 0) console.log("  (Azure F0 ücretsiz kotası içindeyseniz ses için ödeme yapılmaz.)");
      if (sonuc.toplamSureSn > ONERILEN_EN_FAZLA_SURE_SN) {
        console.warn(`⚠ Video ${ONERILEN_EN_FAZLA_SURE_SN} saniyeden uzun (${sonuc.toplamSureSn.toFixed(1)} sn). Süre sese göre ayarlandı.`);
      }
      console.log(`  Videoyu üretmek için: npm run render:ornek -- ${klasor} --senaryo ${path.relative(process.cwd(), ciktiYolu)}`);
    }),
  );

await program.parseAsync();
