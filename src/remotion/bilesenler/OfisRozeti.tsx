import { Img, staticFile } from "remotion";
import { useGorunum } from "../gorunum.js";

type Props = { ad: string; logo: string | null; boyut?: number };

/** Emlak ofisinin adı ve varsa logosu. Logo yoksa yalnızca ad, tasarım bozulmadan gösterilir. */
export const OfisRozeti: React.FC<Props> = ({ ad, logo, boyut = 36 }) => {
  const { tema, vurgu } = useGorunum();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: boyut * 0.45, minWidth: 0 }}>
      {logo ? (
        <Img
          src={staticFile(logo)}
          style={{ height: boyut * 1.8, width: "auto", maxWidth: boyut * 5, objectFit: "contain", flexShrink: 0 }}
        />
      ) : (
        <div style={{ width: boyut * 0.3, height: boyut * 1.1, background: vurgu, borderRadius: 4, flexShrink: 0 }} />
      )}
      <div
        style={{
          color: tema.yazi,
          fontSize: boyut,
          fontWeight: 700,
          letterSpacing: "0.01em",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {ad}
      </div>
    </div>
  );
};
