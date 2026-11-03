import { Command } from "commander";
import { ilanKlasorunuDogrula } from "../pipeline/dogrulama.js";
import { eksikFotograflariUret } from "../pipeline/ornekGorsel.js";

const program = new Command()
  .name("dogrula")
  .description("İlan klasörünü doğrular: ilan.json şeması, fotoğraflar ve onaysız bilgiler.")
  .argument("<klasor>", "ilan klasörü, ör. ilanlar/temurlar")
  .option("--ornek-gorsel", "eksik fotoğraflar için üzerinde ÖRNEK yazan yer tutucu görseller üret")
  .action(async (klasor: string, secenekler: { ornekGorsel?: boolean }) => {
    let sonuc = await ilanKlasorunuDogrula(klasor);

    if (secenekler.ornekGorsel && sonuc.ilan) {
      const uretilenler = await eksikFotograflariUret(klasor, sonuc.ilan.fotograflar);
      if (uretilenler.length > 0) {
        console.warn(
          `⚠ ${uretilenler.length} eksik fotoğraf için ÖRNEK yer tutucu üretildi: ${uretilenler.join(", ")}\n` +
            "  Bunlar gerçek fotoğraf değildir, yalnızca test içindir. Müşteriye gönderilecek videoda kullanmayın.\n",
        );
      }
      sonuc = await ilanKlasorunuDogrula(klasor);
    }

    console.log(sonuc.rapor.markdown());
    if (!sonuc.rapor.gecerli) {
      console.error(`✗ İlan geçersiz: ${sonuc.rapor.hatalar.length} hata bulundu.`);
      process.exitCode = 1;
    } else {
      console.log(`✓ İlan geçerli (${sonuc.rapor.uyarilar.length} uyarı).`);
    }
  });

await program.parseAsync();
