import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";
import { tema } from "./tema.js";

/** Değişken Inter fontu tek dosyada tüm kalınlıkları içerir. Yükleme bitene kadar render bekletilir. */
export const fontYuklendi = loadFont({
  family: tema.yazi.aile,
  url: staticFile(tema.yazi.dosya),
  weight: "100 900",
  format: "truetype",
});
