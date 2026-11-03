import { tema } from "./tema.js";
import type { Sahne } from "./tipler.js";

export const sahneKareSayisi = (sahne: Pick<Sahne, "sureSn">, fps: number = tema.video.fps) =>
  Math.round(sahne.sureSn * fps);

/** Geçişler sahneleri üst üste bindirdiği için toplam süre, geçiş sayısı kadar kısalır. */
export function toplamKareSayisi(sahneler: Pick<Sahne, "sureSn">[], fps: number = tema.video.fps): number {
  const toplam = sahneler.reduce((t, s) => t + sahneKareSayisi(s, fps), 0);
  return toplam - Math.max(0, sahneler.length - 1) * tema.hareket.gecisKare;
}

/**
 * Başlık uzadıkça yazı küçülür. Taşma CSS'teki satır sınırıyla ayrıca engellenir;
 * bu hesap uzun başlığın yine de okunaklı kalması içindir.
 */
export function baslikYaziBoyutu(baslik: string): number {
  const uzunluk = [...baslik].length;
  if (uzunluk <= 18) return 92;
  if (uzunluk <= 28) return 80;
  if (uzunluk <= 42) return 68;
  return 58;
}

export const BASLIK_EN_FAZLA_SATIR = 3;
export const ALTYAZI_EN_FAZLA_SATIR = 4;

export function altyaziYaziBoyutu(metin: string): number {
  const uzunluk = [...metin].length;
  if (uzunluk <= 90) return 46;
  if (uzunluk <= 140) return 40;
  return 36;
}

export const dikeyMi = (genislik: number, yukseklik: number) => genislik / yukseklik < tema.dikeyOranSiniri;
