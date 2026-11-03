import { AbsoluteFill } from "remotion";
import { tema } from "../tema.js";

/** Üstte başlık, altta altyazı okunabilsin diye fotoğrafın kenarlarını koyulaştırır. */
export const Karartma: React.FC = () => (
  <AbsoluteFill
    style={{
      background: `linear-gradient(to bottom,
        ${tema.renkler.lacivertKoyu}E6 0%,
        ${tema.renkler.lacivertKoyu}99 18%,
        transparent 36%,
        transparent 58%,
        ${tema.renkler.lacivertKoyu}B3 80%,
        ${tema.renkler.lacivertKoyu}F2 100%)`,
    }}
  />
);
