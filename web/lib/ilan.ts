import type { IlanBilgileri } from "@cekirdek/veri/ilanFormu.js";

export type IlanDurumu = "taslak" | "uretiliyor" | "kontrol_bekliyor" | "onaylandi" | "hata";

export const DURUM_ADLARI: Record<IlanDurumu, string> = {
  taslak: "Taslak",
  uretiliyor: "Üretiliyor",
  kontrol_bekliyor: "Kontrol bekliyor",
  onaylandi: "Onaylandı",
  hata: "Hata",
};

/** Listede ve sayfa başlığında: "2+1 daire · Erkmen, Merkez". Eksik taslakta olanı gösterir. */
export function ilanBasligi(veri: Partial<IlanBilgileri>): string {
  const konum = [veri.konum?.mahalle, veri.konum?.ilce].filter(Boolean).join(", ");
  const parcalar = [veri.odaSayisi ? `${veri.odaSayisi} daire` : null, konum || null].filter(Boolean);
  return parcalar.length ? parcalar.join(" · ") : "Adsız ilan";
}

export const fiyatMetni = (veri: Partial<IlanBilgileri>) =>
  typeof veri.fiyatTl?.deger === "number" ? `${veri.fiyatTl.deger.toLocaleString("tr-TR")} TL` : null;

export const tarihMetni = (tarih: Date) =>
  tarih.toLocaleString("tr-TR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" });
