import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { KOMPOZISYON_ID, type VideoProps } from "../remotion/tipler.js";
import { webpackAyari } from "../remotion/webpack.js";

const GIRIS_NOKTASI = path.resolve(import.meta.dirname, "../remotion/index.ts");

type RenderSecenekleri = {
  props: VideoProps;
  publicKlasoru: string;
  videoYolu: string;
  /** Ayrıca JPEG olarak kaydedilecek kareler. */
  kareler?: { kare: number; yol: string }[];
  ilerleme?: (asama: string, oran: number) => void;
};

export type RenderSonucu = { kareSayisi: number; fps: number; sureSn: number };

export async function videoyuRenderEt(secenekler: RenderSecenekleri): Promise<RenderSonucu> {
  const { props, ilerleme } = secenekler;
  const inputProps = props as unknown as Record<string, unknown>;

  const serveUrl = await bundle({
    entryPoint: GIRIS_NOKTASI,
    webpackOverride: webpackAyari,
    publicDir: secenekler.publicKlasoru,
    onProgress: (yuzde) => ilerleme?.("Paketleme", yuzde / 100),
  });

  const kompozisyon = await selectComposition({ serveUrl, id: KOMPOZISYON_ID, inputProps });

  await renderMedia({
    composition: kompozisyon,
    serveUrl,
    codec: "h264",
    outputLocation: secenekler.videoYolu,
    inputProps,
    onProgress: ({ progress }) => ilerleme?.("Video", progress),
  });

  for (const { kare, yol } of secenekler.kareler ?? []) {
    await renderStill({ composition: kompozisyon, serveUrl, output: yol, frame: kare, inputProps, imageFormat: "jpeg" });
  }

  return {
    kareSayisi: kompozisyon.durationInFrames,
    fps: kompozisyon.fps,
    sureSn: kompozisyon.durationInFrames / kompozisyon.fps,
  };
}
