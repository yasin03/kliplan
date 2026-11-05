import { kontrolMaddeleri } from "./kontrolListesi.js";
import type { Iletisim, Sahne } from "../remotion/tipler.js";
import type { Ilan } from "../schema/ilan.js";
import type { RaporMaddesi } from "./kontrolRaporu.js";
import type { YerTutucu, YerTutucuDegeri } from "./yerTutucu.js";

export type UretimRaporuVerisi = {
  ilan: Ilan;
  /** İnsan okuyacağı için yerel saatle yazılır. */
  tarih: Date;
  /** Sahte sağlayıcıyla üretildiyse rapor bunu en üstte belirtir. */
  test: boolean;
  senaryoSaglayici: string;
  sesSaglayici: string;
  /** Yapay zeka metni elle düzenlendiyse raporda belirtilir. */
  senaryoDuzenlendi?: boolean | undefined;
  sahneler: Sahne[];
  kullanilanYerTutucular: (YerTutucuDegeri & { ad: YerTutucu })[];
  iletisim: Iletisim;
  /** Doğrulama ve sonraki adımların uyarıları. */
  maddeler: RaporMaddesi[];
  sureSn: number;
  dosyaBoyutuBayt: number;
  maliyet: { senaryoUsd: number; sesUsd: number; senaryoOnbellekten: boolean; sesApiCagrisi: number; sesOnbellekten: number };
  renderOnbellekten: boolean;
};

const AD: Record<YerTutucu, string> = { fiyat: "Fiyat", telefon: "Telefon", netM2: "Net m²", konum: "Konum" };
/** Markdown tablosunu bozmasın diye dikey çizgi ve satır sonları kaçırılır. */
const hucre = (metin: string) => metin.replace(/\|/g, "\\|").replace(/\n/g, " ");
const usd = (deger: number) => `~$${deger.toFixed(4)}`;

export function uretimRaporu(v: UretimRaporuVerisi): string {
  const { ilan } = v;
  const satirlar: string[] = [];
  const ekle = (...s: string[]) => satirlar.push(...s);

  ekle(`# Kontrol raporu: ${ilan.emlakOfisi} · ilan ${ilan.ilanNo}`, "");
  if (v.test) {
    ekle("> ⚠ **TEST ÜRETİMİ.** Sahte sağlayıcılarla (`--mock`) üretildi. Metin kalıp cümlelerden oluşuyor, ses sessiz. Müşteriye gönderilmez.", "");
  }
  ekle(
    `- Üretim: ${v.tarih.toLocaleString("tr-TR")}`,
    `- Senaryo: \`${v.senaryoSaglayici}\`${v.senaryoDuzenlendi ? " (elle düzenlendi, kurallarla yeniden doğrulandı)" : ""} · Ses: \`${v.sesSaglayici}\``,
    "",
    "## Videodaki kritik bilgiler",
    "",
    "| Bilgi | Videoda | Kaynak alan | Nerede |",
    "|---|---|---|---|",
  );
  const metinde = new Map(v.kullanilanYerTutucular.map((y) => [y.ad, y]));
  const kritik: [string, string, string, string][] = [
    ["Fiyat", v.iletisim.fiyat, "fiyatTl.deger", metinde.has("fiyat") ? "kapanış kartı, sahne metni" : "kapanış kartı"],
    ["Telefon", v.iletisim.telefon, "telefon.deger", metinde.has("telefon") ? "kapanış kartı, sahne metni" : "kapanış kartı"],
    ["Yetki belge no", v.iletisim.yetkiBelgeNo, "yetkiBelgeNo.deger", "kapanış kartı"],
    ["Emlak ofisi", ilan.emlakOfisi, "emlakOfisi", "rozet, kapanış kartı, dış ses"],
  ];
  if (v.iletisim.konum) kritik.push(["Konum", v.iletisim.konum, "konum", metinde.has("konum") ? "kapanış kartı, sahne metni" : "kapanış kartı"]);
  for (const ad of ["netM2"] as const) {
    const y = metinde.get(ad);
    if (y) kritik.push([AD[ad], y.ekran, y.kaynak, "sahne metni"]);
  }
  for (const [bilgi, deger, kaynak, nerede] of kritik) ekle(`| ${bilgi} | ${hucre(deger)} | \`${kaynak}\` | ${nerede} |`);

  const hatalar = v.maddeler.filter((m) => m.seviye === "hata");
  const uyarilar = v.maddeler.filter((m) => m.seviye === "uyari");
  ekle("", "## Onaysız, eksik veya çelişkili bilgiler", "");
  if (hatalar.length + uyarilar.length === 0) ekle("Yok.");
  for (const m of hatalar) ekle(`- ✗ **${m.alan}:** ${m.mesaj}`);
  for (const m of uyarilar) ekle(`- ⚠ **${m.alan}:** ${m.mesaj}`);

  const onbellek = (evet: boolean) => (evet ? " (önbellekten, API çağrısı yok)" : "");
  ekle(
    "",
    "## Süre, boyut ve maliyet",
    "",
    `- Süre: ${v.sureSn.toFixed(1)} sn · ${v.sahneler.length} sahne`,
    `- Dosya boyutu: ${(v.dosyaBoyutuBayt / 1024 / 1024).toFixed(1)} MB${v.renderOnbellekten ? " (girdiler değişmediği için yeniden render edilmedi)" : ""}`,
    `- Senaryo: ${usd(v.maliyet.senaryoUsd)}${onbellek(v.maliyet.senaryoOnbellekten)}`,
    `- Ses: ${usd(v.maliyet.sesUsd)} (${v.maliyet.sesApiCagrisi} API çağrısı, ${v.maliyet.sesOnbellekten} sahne önbellekten)`,
    `- **Toplam tahmini API maliyeti: ${usd(v.maliyet.senaryoUsd + v.maliyet.sesUsd)}**`,
    "",
    "## Sahneler",
    "",
    "| # | Fotoğraf | Başlık | Altta | Dış ses | Süre |",
    "|---|---|---|---|---|---|",
  );
  for (const [i, s] of v.sahneler.entries()) {
    ekle(`| ${i + 1} | ${hucre(s.fotograf)} | ${hucre(s.baslik)} | ${hucre(s.altyazi ?? "")} | ${hucre(s.disSes)} | ${s.sureSn.toFixed(1)} sn |`);
  }

  ekle(
    "",
    "## Göndermeden önce kontrol listesi",
    "",
    ...kontrolMaddeleri(v.ilan, v.iletisim).map((m) => `- [ ] ${hucre(m.cliNotu ? `${m.metin.replace(/\.$/, "")} (${m.cliNotu}).` : m.metin)}`),
    "",
  );
  return satirlar.join("\n");
}
