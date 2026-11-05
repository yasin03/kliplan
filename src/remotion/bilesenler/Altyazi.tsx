import { interpolate, useCurrentFrame } from "remotion";
import { ALTYAZI_EN_FAZLA_SATIR, altyaziYaziBoyutu } from "../hesap.js";
import { useGorunum } from "../gorunum.js";

/** Faz 2'de sahnenin dış ses metni bütün olarak gösterilir; kelime zamanlaması Faz 4'te eklenecek. */
export const Altyazi: React.FC<{ metin: string }> = ({ metin }) => {
  const kare = useCurrentFrame();
  const opaklik = interpolate(kare, [6, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const boyut = altyaziYaziBoyutu(metin);
  const { tema, vurgu } = useGorunum();

  return (
    <div
      style={{
        opacity: opaklik,
        background: `${tema.kart}C7`,
        borderRadius: Math.round(tema.kose * 0.7),
        padding: "26px 34px",
        borderLeft: `8px solid ${vurgu}`,
      }}
    >
      <div
        style={{
          color: tema.yazi,
          fontSize: boyut,
          fontWeight: 600,
          lineHeight: 1.3,
          display: "-webkit-box",
          WebkitBoxOrient: "vertical",
          WebkitLineClamp: ALTYAZI_EN_FAZLA_SATIR,
          overflow: "hidden",
          overflowWrap: "anywhere",
        }}
      >
        {metin}
      </div>
    </div>
  );
};
