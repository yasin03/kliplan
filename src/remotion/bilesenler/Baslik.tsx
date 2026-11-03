import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { BASLIK_EN_FAZLA_SATIR, baslikYaziBoyutu } from "../hesap.js";
import { tema } from "../tema.js";

export const Baslik: React.FC<{ metin: string }> = ({ metin }) => {
  const kare = useCurrentFrame();
  const { fps } = useVideoConfig();
  const giris = spring({ frame: kare - 4, fps, config: { damping: 200 } });
  const boyut = baslikYaziBoyutu(metin);

  return (
    <div style={{ opacity: giris, transform: `translateY(${interpolate(giris, [0, 1], [24, 0])}px)` }}>
      <div
        style={{
          color: tema.renkler.beyaz,
          fontSize: boyut,
          fontWeight: 800,
          lineHeight: 1.08,
          letterSpacing: "-0.02em",
          textShadow: "0 4px 24px rgba(0, 0, 0, 0.45)",
          display: "-webkit-box",
          WebkitBoxOrient: "vertical",
          WebkitLineClamp: BASLIK_EN_FAZLA_SATIR,
          overflow: "hidden",
          overflowWrap: "anywhere",
          maxHeight: boyut * 1.08 * BASLIK_EN_FAZLA_SATIR + 4,
        }}
      >
        {metin}
      </div>
      <div style={{ width: 96, height: 8, borderRadius: 4, marginTop: 24, background: tema.renkler.vurgu }} />
    </div>
  );
};
