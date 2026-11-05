import path from "node:path";
import type { Depolama } from "./Depolama.js";
import { DepolamaHatasi } from "./Depolama.js";
import { type S3Ayarlari, S3Depolama } from "./S3Depolama.js";
import { YerelDepolama } from "./YerelDepolama.js";

/** `S3_*` değişkenlerinden S3/R2 ayarları; eksik değişken adlarıyla hata verir. `onek` yedek bucket'ı için (`YEDEK_S3_`). */
export function s3Ayarlari(ortam: NodeJS.ProcessEnv = process.env, onek = "S3_"): S3Ayarlari {
  const al = (ad: string) => ortam[`${onek}${ad}`]?.trim() || undefined;
  const zorunlu = ["ENDPOINT", "BUCKET", "ACCESS_KEY_ID", "SECRET_ACCESS_KEY"].filter((ad) => !al(ad));
  if (zorunlu.length) throw new DepolamaHatasi(`S3 depolama için .env'de şunlar eksik: ${zorunlu.map((ad) => `${onek}${ad}`).join(", ")}`);
  return {
    endpoint: al("ENDPOINT")!,
    bucket: al("BUCKET")!,
    erisimAnahtari: al("ACCESS_KEY_ID")!,
    gizliAnahtar: al("SECRET_ACCESS_KEY")!,
    bolge: al("REGION"),
    yolBicimi: al("PATH_STYLE") === "true",
  };
}

/**
 * `.env`'deki `DEPOLAMA` ile seçilir: `yerel` (geliştirme, `.depolama/` klasörü) veya `s3` (sunucuda Cloudflare R2).
 * Kök klasör çağırandan gelir: web paketinde `import.meta.dirname` tanımsız olduğu için burada hesaplanmaz.
 */
export function depolamaOlustur(projeKoku: string, ortam: NodeJS.ProcessEnv = process.env): Depolama {
  const tur = ortam.DEPOLAMA ?? "yerel";
  if (tur === "yerel") {
    return new YerelDepolama(path.join(projeKoku, ".depolama"), ortam.BETTER_AUTH_SECRET ?? "", ortam.BETTER_AUTH_URL ?? "");
  }
  if (tur === "s3") return new S3Depolama(s3Ayarlari(ortam));
  throw new DepolamaHatasi(`Bilinmeyen depolama türü: ${tur}. "yerel" veya "s3" olmalı.`);
}
