import { Composition, type CalculateMetadataFunction } from "remotion";
import "./fontlar.js";
import { toplamKareSayisi } from "./hesap.js";
import { IlanVideosu } from "./IlanVideosu.js";
import { tema } from "./tema.js";
import { KOMPOZISYON_ID, type VideoProps } from "./tipler.js";

const metaHesapla: CalculateMetadataFunction<VideoProps> = ({ props }) => ({
  durationInFrames: Math.max(1, toplamKareSayisi(props.sahneler)),
  defaultCodec: "h264",
});

/** Gerçek veriler render veya Studio komutunda `inputProps` olarak gelir. */
const bosProps: VideoProps = {
  sahneler: [],
  fotograflar: {},
  ofis: { ad: "", logo: null },
  iletisim: { fiyat: "", telefon: "", yetkiBelgeNo: "" },
};

export const Root: React.FC = () => (
  <Composition
    id={KOMPOZISYON_ID}
    component={IlanVideosu}
    width={tema.video.genislik}
    height={tema.video.yukseklik}
    fps={tema.video.fps}
    durationInFrames={1}
    defaultProps={bosProps}
    calculateMetadata={metaHesapla}
  />
);
