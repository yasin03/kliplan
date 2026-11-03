import type { Duzeltme, YzGirdisi } from "../pipeline/senaryoIstemi.js";

export type SenaryoIstegi = {
  sistem: string;
  kullanici: string;
  /** Yapılandırılmış hali; sahte sağlayıcı metin yerine bunu kullanır. */
  girdi: YzGirdisi;
  duzeltme?: Duzeltme | undefined;
};

export type ApiKullanimi = {
  girdiToken: number;
  ciktiToken: number;
  tahminiMaliyetUsd: number;
};

export type SaglayiciYaniti = {
  /** Doğrulanmamış ham çıktı; kullanılmadan önce senaryo doğrulamasından geçer. */
  cikti: unknown;
  kullanim?: ApiKullanimi | undefined;
};

/** Sahne metnini üreten yapay zeka sağlayıcısı. Gerçek ve sahte uygulamalar bu arayüzü paylaşır. */
export interface ScriptProvider {
  /** Önbellek anahtarına girer: sağlayıcı, model veya ayar değişince önbellek geçersiz olur. */
  readonly kimlik: string;
  readonly ucretli: boolean;
  senaryoUret(istek: SenaryoIstegi): Promise<SaglayiciYaniti>;
}

export class SaglayiciHatasi extends Error {}
