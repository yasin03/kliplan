import { AbsoluteFill } from "remotion";
import { useGorunum } from "../gorunum.js";

/** Üstte başlık, altta altyazı okunabilsin diye fotoğrafın kenarlarını tema zeminine doğru koyulaştırır (açık temada açar). */
export const Karartma: React.FC = () => {
  const renk = useGorunum().tema.karartma;
  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(to bottom,
          ${renk}E6 0%,
          ${renk}99 18%,
          transparent 36%,
          transparent 58%,
          ${renk}B3 80%,
          ${renk}F2 100%)`,
      }}
    />
  );
};
