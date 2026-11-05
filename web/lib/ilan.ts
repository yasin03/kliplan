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

/** Panelde gösterilen iş bilgisi; istemci bileşenine yalnızca gereken alanlar gider. */
export function isOzeti<T extends { tur: "senaryo" | "video"; durum: "bekliyor" | "calisiyor" | "tamamlandi" | "hata"; asama: string | null; ilerleme: number | null; hata: { adim: string; mesaj: string; cozum: string } | null }>(
  is: T | null,
) {
  return is ? { tur: is.tur, durum: is.durum, asama: is.asama, ilerleme: is.ilerleme, hata: is.hata } : null;
}

export const boyutMetni = (bayt: number) => `${(bayt / 1024 / 1024).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} MB`;
