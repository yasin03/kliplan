export type RaporSeviyesi = "hata" | "uyari";

export type RaporMaddesi = {
  seviye: RaporSeviyesi;
  /** Sorunun ilgili olduğu alan, ör. `kiraDurumu` veya `fotograflar[2]`. */
  alan: string;
  mesaj: string;
};

/** Pipeline adımlarının hata ve uyarılarını toplar. Faz 5'te `kontrol-raporu.md` bundan üretilir. */
export class KontrolRaporu {
  readonly maddeler: RaporMaddesi[] = [];

  hata(alan: string, mesaj: string): void {
    this.maddeler.push({ seviye: "hata", alan, mesaj });
  }

  uyari(alan: string, mesaj: string): void {
    this.maddeler.push({ seviye: "uyari", alan, mesaj });
  }

  get hatalar(): RaporMaddesi[] {
    return this.maddeler.filter((m) => m.seviye === "hata");
  }

  get uyarilar(): RaporMaddesi[] {
    return this.maddeler.filter((m) => m.seviye === "uyari");
  }

  get gecerli(): boolean {
    return this.hatalar.length === 0;
  }

  markdown(): string {
    const bolum = (baslik: string, liste: RaporMaddesi[]) =>
      liste.length === 0
        ? `## ${baslik}\n\nYok.\n`
        : `## ${baslik}\n\n${liste.map((m) => `- **${m.alan}:** ${m.mesaj}`).join("\n")}\n`;
    return [bolum("Hatalar", this.hatalar), bolum("Uyarılar", this.uyarilar)].join("\n");
  }
}
