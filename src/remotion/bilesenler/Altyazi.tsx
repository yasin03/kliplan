import { interpolate, useCurrentFrame } from "remotion";
import { ALTYAZI_EN_FAZLA_SATIR, altyaziYaziBoyutu } from "../hesap.js";
import { tema } from "../tema.js";
import { useVurgu } from "../vurgu.js";

/** Faz 2'de sahnenin dış ses metni bütün olarak gösterilir; kelime zamanlaması Faz 4'te eklenecek. */
export const Altyazi: React.FC<{ metin: string }> = ({ metin }) => {
  const kare = useCurrentFrame();
  const opaklik = interpolate(kare, [6, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const boyut = altyaziYaziBoyutu(metin);
  const vurgu = useVurgu();

  return (
    <div
      style={{
        opacity: opaklik,
        background: `${tema.renkler.lacivertKoyu}C7`,
        borderRadius: 28,
        padding: "26px 34px",
        borderLeft: `8px solid ${vurgu}`,
      }}
    >
      <div
        style={{
          color: tema.renkler.beyaz,
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
