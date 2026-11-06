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
  const kapanis = [iletisim.fiyat, iletisim.telefon, iletisim.yetkiBelgeNo && `Yetki Belge No: ${iletisim.yetkiBelgeNo}`, ...(iletisim.ekSatirlar ?? [])].filter(Boolean);
  if (!kapanis.length) kapanis.push(ilan.emlakOfisi);
  const maddeler: KontrolMaddesi[] = [
    {
      kod: "iletisim",
      metin: `Kapanış kartındaki bilgiler doğru (${kapanis.join(", ")}).`,
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
