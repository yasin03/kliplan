import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { dikeyMi } from "../hesap.js";
import { tema } from "../tema.js";
import type { HazirFotograf } from "../tipler.js";

type Props = {
  foto: HazirFotograf;
  /** Hareket yönünü sahneden sahneye değiştirmek için kullanılır. */
  sira: number;
  /** Sahnenin kare cinsinden süresi; hareket bu süreye yayılır. */
  sureKare: number;
};

/**
 * Dikey fotoğraf ekranı kaplar. Yatay veya kare fotoğraf kırpılmadan ortada durur,
 * arkasını aynı fotoğrafın bulanık ve büyütülmüş hali doldurur.
 */
export const FotografKatmani: React.FC<Props> = ({ foto, sira, sureKare }) => {
  const kare = useCurrentFrame();
  const ilerleme = interpolate(kare, [0, sureKare], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const yakinlas = sira % 2 === 0;
  const olcek = interpolate(ilerleme, [0, 1], yakinlas ? [1, tema.hareket.yakinlasma] : [tema.hareket.yakinlasma, 1]);
  const kaydirma = (sira % 4 < 2 ? 1 : -1) * tema.hareket.kaydirma * (ilerleme - 0.5);
  const hareket = `translateX(${kaydirma}px) scale(${olcek})`;
  const src = staticFile(foto.src);

  if (dikeyMi(foto.genislik, foto.yukseklik)) {
    return (
      <AbsoluteFill style={{ overflow: "hidden" }}>
        <Img src={src} style={{ width: "100%", height: "100%", objectFit: "cover", transform: hareket }} />
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Img
        src={src}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          filter: "blur(48px) brightness(0.55)",
          transform: "scale(1.2)",
        }}
      />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", paddingBottom: 120 }}>
        <Img
          src={src}
          style={{
            width: "100%",
            height: "auto",
            maxHeight: "70%",
            objectFit: "contain",
            transform: hareket,
            boxShadow: "0 30px 80px rgba(0, 0, 0, 0.45)",
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
