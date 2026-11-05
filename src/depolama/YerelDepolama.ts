import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { anahtariDogrula, type Depolama, DepolamaHatasi, GECERLI_INDIRME_ADI, imzala } from "./Depolama.js";

/** Geliştirme için: dosyalar diskte tutulur, imzalı bağlantılar web uygulamasının `/dosya/...` yolundan sunulur. */
export class YerelDepolama implements Depolama {
  readonly kimlik = "yerel";

  constructor(
    private readonly kok: string,
    private readonly gizli: string,
    /** Bağlantıların başına eklenir, ör. `http://localhost:3100`. */
    private readonly adres = "",
  ) {
    if (!gizli) throw new DepolamaHatasi("Yerel depolama için imza anahtarı gerekli (BETTER_AUTH_SECRET).");
  }

  private yol(anahtar: string) {
    return path.join(this.kok, anahtariDogrula(anahtar));
  }

  // İçerik türü yerelde dosya uzantısından çıkarılır; R2 için saklanır.
  async yaz(anahtar: string, icerik: Buffer, _icerikTuru: string): Promise<void> {
    const yol = this.yol(anahtar);
    await mkdir(path.dirname(yol), { recursive: true });
    await writeFile(yol, icerik);
  }

  async oku(anahtar: string): Promise<Buffer> {
    try {
      return await readFile(this.yol(anahtar));
    } catch {
      throw new DepolamaHatasi(`Dosya bulunamadı: ${anahtar}`);
    }
  }

  async sil(anahtar: string): Promise<void> {
    await rm(this.yol(anahtar), { force: true });
  }

  async onekSil(onek: string): Promise<void> {
    const temiz = onek.replace(/\/$/, "");
    await rm(this.yol(temiz), { recursive: true, force: true });
  }

  async imzaliBaglanti(anahtar: string, sureSn: number, indirmeAdi?: string): Promise<string> {
    if (indirmeAdi !== undefined && !GECERLI_INDIRME_ADI.test(indirmeAdi)) throw new DepolamaHatasi(`Geçersiz indirme adı: ${indirmeAdi}`);
    const son = Date.now() + sureSn * 1000;
    const imza = imzala(anahtariDogrula(anahtar), son, this.gizli, indirmeAdi);
    return `${this.adres}/dosya/${anahtar}?son=${son}&imza=${imza}${indirmeAdi ? `&indir=${indirmeAdi}` : ""}`;
  }
}
