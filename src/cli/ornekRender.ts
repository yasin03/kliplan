import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { Command } from "commander";
import { toplamKareSayisi } from "../remotion/hesap.js";
import { tema } from "../remotion/tema.js";
import { videoyuRenderEt } from "../pipeline/render.js";
import { calistir, ilanAdi, KomutHatasi, ornekVideoVerisiHazirla } from "./ortak.js";

/** "30,150,son" → kare numaraları. "son", kapanış sahnesinin ortasını seçer. */
function kareleriCoz(metin: string, sahneSureleri: number[]): number[] {
  const toplam = toplamKareSayisi(sahneSureleri.map((sureSn) => ({ sureSn })));
  const sonSahneKare = Math.round((sahneSureleri.at(-1) ?? 0) * tema.video.fps);
  return metin.split(",").map((parca) => {
    const p = parca.trim();
    if (p === "son") return toplam - Math.round(sonSahneKare / 2);
    const kare = Number(p);
    if (!Number.isInteger(kare) || kare < 0 || kare >= toplam) {
      throw new KomutHatasi(`Geçersiz kare numarası: "${p}". 0 ile ${toplam - 1} arasında olmalı.`);
    }
    return kare;
  });
}

const program = new Command()
  .name("render:ornek")
  .description("Elle yazılmış örnek sahnelerden MP4 üretir (yapay zeka ve ses kullanmaz).")
  .argument("<klasor>", "ilan klasörü, ör. ilanlar/temurlar")
  .option("--senaryo <dosya>", "sahne listesi JSON dosyası (varsayılan: <klasor>/ornek-sahneler.json)")
  .option("--cikti <dosya>", "MP4 dosyasının yolu (varsayılan: cikti/<ilan>/ornek.mp4)")
  .option("--kareler <liste>", 'ayrıca JPEG olarak kaydedilecek kareler, ör. "30,150,450,son"')
  .action((klasor: string, secenekler: { senaryo?: string; cikti?: string; kareler?: string }) =>
    calistir(async () => {
      console.log("1/3 İlan doğrulanıyor ve fotoğraflar hazırlanıyor…");
      const { props, publicKlasoru } = await ornekVideoVerisiHazirla(klasor, secenekler.senaryo);

      const videoYolu = path.resolve(secenekler.cikti ?? path.join("cikti", ilanAdi(klasor), "ornek.mp4"));
      await mkdir(path.dirname(videoYolu), { recursive: true });
      const kareler = secenekler.kareler
        ? kareleriCoz(secenekler.kareler, props.sahneler.map((s) => s.sureSn)).map((kare) => ({
            kare,
            yol: path.join(path.dirname(videoYolu), `kare-${String(kare).padStart(4, "0")}.jpg`),
          }))
        : [];

      let sonYuzde = -1;
      const sonuc = await videoyuRenderEt({
        props,
        publicKlasoru,
        videoYolu,
        kareler,
        ilerleme: (asama, oran) => {
          const yuzde = Math.floor(oran * 10) * 10;
          if (yuzde === sonYuzde) return;
          sonYuzde = yuzde;
          console.log(`${asama === "Paketleme" ? "2/3" : "3/3"} ${asama}: %${yuzde}`);
        },
      });

      const boyutMb = (await stat(videoYolu)).size / 1024 / 1024;
      console.log(`✓ Video hazır: ${path.relative(process.cwd(), videoYolu)}`);
      console.log(`  Süre: ${sonuc.sureSn.toFixed(1)} sn · ${sonuc.kareSayisi} kare · ${boyutMb.toFixed(1)} MB`);
      for (const k of kareler) console.log(`  Kare ${k.kare}: ${path.relative(process.cwd(), k.yol)}`);
      if (sonuc.sureSn < 20 || sonuc.sureSn > 30) {
        console.warn(`⚠ Video süresi 20-30 saniye aralığının dışında (${sonuc.sureSn.toFixed(1)} sn).`);
      }
    }),
  );

await program.parseAsync();
