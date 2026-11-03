import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { Fragment } from "react";
import { AbsoluteFill } from "remotion";
import { Altyazi } from "./bilesenler/Altyazi.js";
import { Baslik } from "./bilesenler/Baslik.js";
import { FotografKatmani } from "./bilesenler/FotografKatmani.js";
import { KapanisKarti } from "./bilesenler/KapanisKarti.js";
import { Karartma } from "./bilesenler/Karartma.js";
import { OfisRozeti } from "./bilesenler/OfisRozeti.js";
import { sahneKareSayisi } from "./hesap.js";
import { tema } from "./tema.js";
import type { Sahne, VideoProps } from "./tipler.js";

const { guvenliAlan } = tema;

type SahneProps = {
  sahne: Sahne;
  sira: number;
  kapanis: boolean;
  props: VideoProps;
};

const SahneGorunumu: React.FC<SahneProps> = ({ sahne, sira, kapanis, props }) => {
  const foto = props.fotograflar[sahne.fotograf];
  if (!foto) throw new Error(`Sahne ${sira + 1}: "${sahne.fotograf}" fotoğrafı hazırlanmamış.`);

  return (
    <AbsoluteFill>
      <FotografKatmani foto={foto} sira={sira} sureKare={sahneKareSayisi(sahne)} />
      <Karartma />
      {kapanis ? <AbsoluteFill style={{ background: `${tema.renkler.lacivertKoyu}8C` }} /> : null}

      <div
        style={{
          position: "absolute",
          top: guvenliAlan.ust,
          left: guvenliAlan.sol,
          right: guvenliAlan.sag,
          display: "flex",
          flexDirection: "column",
          gap: 28,
        }}
      >
        {kapanis ? null : <OfisRozeti ad={props.ofis.ad} logo={props.ofis.logo} />}
        <Baslik metin={sahne.baslik} />
      </div>

      {kapanis ? (
        <AbsoluteFill style={{ justifyContent: "center", padding: `0 ${guvenliAlan.sag}px 0 ${guvenliAlan.sol}px` }}>
          <div style={{ marginTop: -60 }}>
            <KapanisKarti iletisim={props.iletisim} ofis={props.ofis} />
          </div>
        </AbsoluteFill>
      ) : null}

      <div style={{ position: "absolute", bottom: guvenliAlan.alt, left: guvenliAlan.sol, right: guvenliAlan.sagAlt }}>
        <Altyazi metin={sahne.altyazi ?? sahne.disSes} />
      </div>
    </AbsoluteFill>
  );
};

export const IlanVideosu: React.FC<VideoProps> = (props) => {
  const { sahneler } = props;
  return (
    <AbsoluteFill lang="tr" style={{ background: tema.renkler.lacivertKoyu, fontFamily: `${tema.yazi.aile}, sans-serif` }}>
      <TransitionSeries>
        {sahneler.map((sahne, sira) => (
          <Fragment key={sira}>
            {sira > 0 ? (
              <TransitionSeries.Transition
                presentation={fade()}
                timing={linearTiming({ durationInFrames: tema.hareket.gecisKare })}
              />
            ) : null}
            <TransitionSeries.Sequence durationInFrames={sahneKareSayisi(sahne)} name={`${sira + 1}. ${sahne.baslik}`}>
              <SahneGorunumu sahne={sahne} sira={sira} kapanis={sira === sahneler.length - 1} props={props} />
            </TransitionSeries.Sequence>
          </Fragment>
        ))}
      </TransitionSeries>
    </AbsoluteFill>
  );
};
