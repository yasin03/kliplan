import path from "node:path";
import type { Depolama } from "./Depolama.js";
import { DepolamaHatasi } from "./Depolama.js";
import { YerelDepolama } from "./YerelDepolama.js";

/**
 * `.env`'deki `DEPOLAMA` ile seçilir. S3/R2 sağlayıcısı sunucu kurulumunda (6.8) eklenecek.
 * Kök klasör çağırandan gelir: web paketinde `import.meta.dirname` tanımsız olduğu için burada hesaplanmaz.
 */
export function depolamaOlustur(projeKoku: string, ortam: NodeJS.ProcessEnv = process.env): Depolama {
  const tur = ortam.DEPOLAMA ?? "yerel";
  if (tur === "yerel") {
    return new YerelDepolama(path.join(projeKoku, ".depolama"), ortam.BETTER_AUTH_SECRET ?? "", ortam.BETTER_AUTH_URL ?? "");
  }
  throw new DepolamaHatasi(`Bilinmeyen depolama türü: ${tur}. Şimdilik yalnızca "yerel" destekleniyor.`);
}
