import type { Iletisim } from "../remotion/tipler.js";
import type { Ilan } from "../schema/ilan.js";

export type KontrolMaddesi = {
  /** Onay kaydında ve formda maddeyi tanır. */
  kod: string;
  metin: string;
  /** Yalnızca CLI raporunda gösterilen ek bilgi. */
  cliNotu?: string;
};

/**
 * Video gönderilmeden önce insanın kontrol edeceği maddeler. Kontrol raporu (CLI) ve web panelindeki
 * onay ekranı aynı listeyi kullanır; panelde hepsi işaretlenmeden video onaylanamaz.
 */
export function kontrolMaddeleri(ilan: Ilan, iletisim: Iletisim): KontrolMaddesi[] {
  const maddeler: KontrolMaddesi[] = [
    {
      kod: "iletisim",
      metin: iletisim.ekSatirlar?.length
        ? `Fiyat, telefon, yetki belge numarası ve kapanıştaki şirket bilgileri doğru (${[iletisim.fiyat, iletisim.telefon, iletisim.yetkiBelgeNo, ...iletisim.ekSatirlar].join(", ")}).`
        : `Fiyat, telefon ve yetki belge numarası doğru (${iletisim.fiyat}, ${iletisim.telefon}, ${iletisim.yetkiBelgeNo}).`,
    },
    { kod: "ifade", metin: "Dış seste ilanda olmayan veya abartılı bir ifade yok." },
    { kod: "okunus", metin: "Ofis, mahalle ve marka adları doğru okunuyor.", cliNotu: "yanlışsa `telaffuz.json`" },
    { kod: "ses", metin: "Ses sonuna kadar duyuluyor, sahne değişirken kesilmiyor." },
    { kod: "fotograf", metin: "Fotoğraflar doğru ilana ait, bulanık veya kötü kırpılmış değil." },
    { kod: "uyarilar", metin: "Kontrol raporundaki uyarıların hepsi gözden geçirildi." },
  ];
  if (ilan.muzik) maddeler.push({ kod: "muzik", metin: `Müziğin ticari kullanım izni doğrulandı (${ilan.muzik.lisans}).` });
  maddeler.push({ kod: "izlendi", metin: "Video baştan sona izlendi." });
  return maddeler;
}
