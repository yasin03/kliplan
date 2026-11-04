/** Yazılışı → okunuşu. Metin ise SSML `<sub alias>`, `{ ipa }` ise `<phoneme>` olarak gönderilir. */
export type TelaffuzSozlugu = Record<string, string | { ipa: string }>;

export type SesIstegi = {
  /** Okunacak düz metin. */
  metin: string;
  sozluk: TelaffuzSozlugu;
};

/** `metin` içindeki bir kelimenin seste nerede okunduğu. */
export type KelimeZamani = {
  baslangicKarakter: number;
  uzunluk: number;
  baslangicSn: number;
  bitisSn: number;
};

export type SesYaniti = {
  ses: Uint8Array;
  uzanti: "mp3" | "wav";
  sureSn: number;
  kelimeler: KelimeZamani[];
  /** Ücretlendirilen karakter sayısı. */
  karakterSayisi: number;
  tahminiMaliyetUsd: number;
};

/** Metinden ses üreten sağlayıcı. Gerçek ve sahte uygulamalar bu arayüzü paylaşır. */
export interface TtsProvider {
  /** Önbellek anahtarına girer: sağlayıcı veya ses değişince önbellek geçersiz olur. */
  readonly kimlik: string;
  readonly ucretli: boolean;
  seslendir(istek: SesIstegi): Promise<SesYaniti>;
}
