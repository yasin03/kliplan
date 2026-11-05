import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { KOMPOZISYON_ID, type VideoProps } from "../remotion/tipler.js";
import { webpackAyari } from "../remotion/webpack.js";

const GIRIS_NOKTASI = path.resolve(import.meta.dirname, "../remotion/index.ts");

/**
 * Remotion'ın varsayılan "headless shell" Chrome'u macOS 26'da GPU süreci açılırken çöküyor
 * ("Target closed", icudtl.dat bulunamadı); orada tam Chrome for Testing kullanılır. Sunucuda (Linux, Docker)
 * Remotion'ın önerdiği headless shell ve çok süreçli kip (`enableMultiProcessOnLinux`).
 */
const CHROME_MODU = process.platform === "darwin" ? ("chrome-for-testing" as const) : ("headless-shell" as const);
const CHROMIUM_AYARLARI = { enableMultiProcessOnLinux: true };

type RenderSecenekleri = {
  props: VideoProps;
  publicKlasoru: string;
  videoYolu: string;
  /** Ayrıca JPEG olarak kaydedilecek kareler. */
  kareler?: { kare: number; yol: string }[];
  ilerleme?: (asama: string, oran: number) => void;
};

export type RenderSonucu = { kareSayisi: number; fps: number; sureSn: number };

async function hazirla(props: VideoProps, publicKlasoru: string, ilerleme?: (asama: string, oran: number) => void) {
  const inputProps = props as unknown as Record<string, unknown>;
  const serveUrl = await bundle({
    entryPoint: GIRIS_NOKTASI,
    webpackOverride: webpackAyari,
    publicDir: publicKlasoru,
    onProgress: (yuzde) => ilerleme?.("Paketleme", yuzde / 100),
  });
  const kompozisyon = await selectComposition({ serveUrl, id: KOMPOZISYON_ID, inputProps, chromeMode: CHROME_MODU, chromiumOptions: CHROMIUM_AYARLARI });
  return { inputProps, serveUrl, kompozisyon };
}

export async function videoyuRenderEt(secenekler: RenderSecenekleri): Promise<RenderSonucu> {
  const { props, ilerleme } = secenekler;
  const { inputProps, serveUrl, kompozisyon } = await hazirla(props, secenekler.publicKlasoru, ilerleme);

  await renderMedia({
    composition: kompozisyon,
    serveUrl,
    codec: "h264",
    outputLocation: secenekler.videoYolu,
    inputProps,
    chromeMode: CHROME_MODU,
    chromiumOptions: CHROMIUM_AYARLARI,
    onProgress: ({ progress }) => ilerleme?.("Video", progress),
  });

  for (const { kare, yol } of secenekler.kareler ?? []) {
    await renderStill({ composition: kompozisyon, serveUrl, output: yol, frame: kare, inputProps, imageFormat: "jpeg", chromeMode: CHROME_MODU, chromiumOptions: CHROMIUM_AYARLARI });
  }

  return {
    kareSayisi: kompozisyon.durationInFrames,
    fps: kompozisyon.fps,
    sureSn: kompozisyon.durationInFrames / kompozisyon.fps,
  };
}

/** Video üretmeden yalnızca seçilen kareleri JPEG olarak kaydeder (tema önizlemesi için). */
export async function kareleriRenderEt(props: VideoProps, publicKlasoru: string, kareler: { kare: number; yol: string }[]): Promise<void> {
  const { inputProps, serveUrl, kompozisyon } = await hazirla(props, publicKlasoru);
  for (const { kare, yol } of kareler) {
    await renderStill({ composition: kompozisyon, serveUrl, output: yol, frame: kare, inputProps, imageFormat: "jpeg", chromeMode: CHROME_MODU, chromiumOptions: CHROMIUM_AYARLARI });
  }
}
