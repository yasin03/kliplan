import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { tema } from "../tema.js";
import type { Iletisim, VideoProps } from "../tipler.js";
import { OfisRozeti } from "./OfisRozeti.js";

type Props = { iletisim: Iletisim; ofis: VideoProps["ofis"] };

/** Son sahnedeki fiyat, telefon, ofis ve yetki belge bilgisi. Değerler kod tarafından biçimlendirilmiş gelir. */
export const KapanisKarti: React.FC<Props> = ({ iletisim, ofis }) => {
  const kare = useCurrentFrame();
  const { fps } = useVideoConfig();
  const giris = spring({ frame: kare - 8, fps, config: { damping: 200 } });

  return (
    <div
      style={{
        opacity: giris,
        transform: `scale(${0.96 + giris * 0.04})`,
        background: `${tema.renkler.lacivert}EB`,
        borderRadius: 40,
        borderTop: `10px solid ${tema.renkler.vurgu}`,
        padding: "48px 52px",
        display: "flex",
        flexDirection: "column",
        gap: 18,
        boxShadow: "0 40px 100px rgba(0, 0, 0, 0.5)",
      }}
    >
      <div style={{ color: tema.renkler.vurgu, fontSize: 104, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1 }}>
        {iletisim.fiyat}
      </div>
      {iletisim.konum ? (
        <div style={{ color: tema.renkler.beyazSoluk, fontSize: 36, fontWeight: 500 }}>{iletisim.konum}</div>
      ) : null}
      <div style={{ height: 2, background: "rgba(255, 255, 255, 0.18)", margin: "10px 0" }} />
      <div
        style={{
          color: tema.renkler.beyaz,
          fontSize: 76,
          fontWeight: 800,
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "-0.01em",
          lineHeight: 1.05,
        }}
      >
        {iletisim.telefon}
      </div>
      <OfisRozeti ad={ofis.ad} logo={ofis.logo} boyut={42} />
      <div style={{ color: tema.renkler.beyazSoluk, fontSize: 30, fontWeight: 500 }}>
        Yetki Belge No: {iletisim.yetkiBelgeNo}
      </div>
    </div>
  );
};
