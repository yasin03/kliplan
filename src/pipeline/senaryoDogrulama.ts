import { alanYolu, turkceHataHaritasi } from "../schema/hatalar.js";
import type { Ilan } from "../schema/ilan.js";
import { type YzSenaryo, yzSenaryoSemasi } from "../schema/senaryo.js";
import { izinliSayiKelimeleri, sayiKelimesi, TUM_SAYI_KELIMELERI } from "./sayilar.js";
import {
  SESTE_YASAK,
  YER_TUTUCU_DESENI,
  YER_TUTUCULAR,
  type YerTutucu,
  type YerTutucuDegeri,
  yerTutuculariBul,
  yerTutuculariDoldur,
} from "./yerTutucu.js";

export const KELIME_SINIRI = { en_az: 55, en_fazla: 70 } as const;
export const SAHNE_SINIRI = { en_az: 4, en_fazla: 8 } as const;
export const BASLIK_EN_FAZLA_KARAKTER = 32;
export const EKRAN_METNI_EN_FAZLA_KARAKTER = 40;

/** Abartılı veya doğrulanamayan ifadeler. Kök olarak aranır: "fırsat" → "fırsatı", "fırsatlar". */
export const YASAKLI_IFADELER = [
  "fırsat",
  "en iyi",
  "en güzel",
  "en uygun",
  "en ideal",
  "kaçırılmaz",
  "kaçırmayın",
  "kaçmaz",
  "garanti",
  "getiri",
  "yatırımlık",
  "değer kazan",
  "eşsiz",
  "muhteşem",
  "harika",
  "mükemmel",
  "benzersiz",
  "şahane",
  "rüya",
  "hayalinizdeki",
  "lüks",
  "prestij",
  "ayrıcalık",
  "kelepir",
  "ucuz",
  "uygun fiyat",
  "acele",
  "sınırlı sayıda",
  "son daire",
  "geniş",
  "ferah",
  "aydınlık",
  "sessiz",
  "huzurlu",
  "merkezi",
  "kaliteli",
  "konforlu",
  "süper",
  "ultra",
];

/**
 * İlanda yoksa yazılamayacak somut özellikler. Metinde geçip ilan metinlerinde
 * (özellikler, ısıtma, mutfak, tapu) geçmiyorsa uydurma sayılır.
 */
export const OZELLIK_SOZLUGU = [
  "havuz",
  "güvenlik",
  "kapalı otopark",
  "otopark",
  "site",
  "spor salonu",
  "fitness",
  "sauna",
  "jakuzi",
  "şömine",
  "klima",
  "bahçe",
  "teras",
  "deniz",
  "göl",
  "manzara",
  "metro",
  "okul",
  "hastane",
  "avm",
  "kombi",
  "doğalgaz",
  "yerden ısıtma",
  "asansör",
  "cam balkon",
  "ebeveyn banyo",
  "giyinme odası",
  "kiler",
  "depo",
  "jeneratör",
  "hidrofor",
  "kapıcı",
  "oyun parkı",
  "ankastre",
  "akıllı ev",
  "yalıtım",
  "çelik kapı",
  "parke",
  "laminat",
  "diyafon",
  "hilton",
  "amerikan mutfak",
  "buzdolabı",
  "bulaşık makinesi",
  "çamaşır makinesi",
  "koltuk",
];

/** Kritik bilgilere ait, yalnızca yer tutucuyla yazılabilecek kökler. */
const KRITIK_KOKLER: [string, string][] = [
  ["lira", "fiyat için {{fiyat}} kullanın"],
  ["tl", "fiyat için {{fiyat}} kullanın"],
  ["metrekare", "alan için {{netM2}} kullanın"],
  ["m²", "alan için {{netM2}} kullanın"],
  ["yetki belge", "yetki belgesi videoya kod tarafından eklenir"],
  ["telefon numara", "telefon kapanış ekranında gösterilir"],
];

const kucult = (metin: string) => metin.toLocaleLowerCase("tr-TR");
const kacis = (metin: string) => metin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Kelime başında başlayan kök eşleşmesi. */
const kokDeseni = (kok: string) => new RegExp(`(?<![\\p{L}\\p{N}])${kacis(kok)}`, "u");

export type DogrulamaBaglami = {
  ilan: Ilan;
  tablo: Partial<Record<YerTutucu, YerTutucuDegeri>>;
};

/** Yer tutucular bir kelime sayılır. */
export function kelimeSayisi(metin: string): number {
  return metin.replace(YER_TUTUCU_DESENI, " X ").split(/\s+/).filter((k) => /[\p{L}\p{N}]/u.test(k)).length;
}

/** İlanın, yapay zekanın "bildiği" kabul edilen metin alanları (küçük harfle). */
function ilanMetinleri(ilan: Ilan): string {
  return kucult(
    [ilan.isitma, ilan.mutfak, ilan.tapu, ...ilan.ozellikler, ilan.esyali ? "eşyalı" : ""].filter(Boolean).join(" | "),
  );
}

/** Onaysız bilgilere ait, metinde geçmemesi gereken kökler. */
function onaysizKokler(ilan: Ilan): { kok: string; alan: string }[] {
  const kokler: { kok: string; alan: string }[] = [];
  if (ilan.kiraDurumu && !ilan.kiraDurumu.onayli) {
    for (const kok of ["kira", "kiracı"]) kokler.push({ kok, alan: "kira durumu" });
  }
  if (!ilan.konum.onayli) {
    for (const kok of [ilan.konum.mahalle, ilan.konum.ilce, ilan.konum.il]) kokler.push({ kok: kucult(kok), alan: "konum" });
  }
  if (!ilan.esyali) kokler.push({ kok: "eşyalı", alan: "eşya durumu" });
  if (!ilan.krediyeUygun) kokler.push({ kok: "kredi", alan: "krediye uygunluk" });
  if (ilan.binaYasi > 0) kokler.push({ kok: "sıfır bina", alan: "bina yaşı" }, { kok: "yeni bina", alan: "bina yaşı" });
  return kokler;
}

function metniDenetle(metin: string, yer: string, alanTuru: "baslik" | "disSes", baglam: DogrulamaBaglami): string[] {
  const hatalar: string[] = [];
  const { ilan, tablo } = baglam;

  for (const ad of yerTutuculariBul(metin)) {
    if (!(YER_TUTUCULAR as readonly string[]).includes(ad)) {
      hatalar.push(`${yer}: bilinmeyen yer tutucu {{${ad}}}. Yalnızca ${YER_TUTUCULAR.map((y) => `{{${y}}}`).join(", ")} kullanılabilir.`);
    } else if (!tablo[ad as YerTutucu]) {
      hatalar.push(`${yer}: {{${ad}}} onaylı olmayan bir bilgiye ait, kullanılamaz.`);
    } else if (alanTuru === "disSes" && SESTE_YASAK.includes(ad as YerTutucu)) {
      hatalar.push(`${yer}: {{${ad}}} dış seste kullanılamaz; telefon yerine "${ilan.emlakOfisi}" adı ile aranmasını söyleyin.`);
    }
  }
  if (/\{\{[^}]*\}\}[\p{L}'’]/u.test(metin)) {
    hatalar.push(`${yer}: yer tutucuya ek getirilemez (ör. "{{konum}}'da" yerine "{{konum}} konumunda" yazın).`);
  }

  const yerTutucusuz = metin.replace(YER_TUTUCU_DESENI, " ");
  if (/\{\{|\}\}/.test(yerTutucusuz)) hatalar.push(`${yer}: hatalı yer tutucu yazımı (süslü parantez).`);
  const rakamlar = yerTutucusuz.match(/\d+/g);
  if (rakamlar) hatalar.push(`${yer}: rakam kullanılamaz (${rakamlar.join(", ")}). Sayıları yazıyla veya yer tutucuyla yazın.`);

  const kucuk = kucult(yerTutucusuz);
  for (const ifade of YASAKLI_IFADELER) {
    if (kokDeseni(ifade).test(kucuk)) hatalar.push(`${yer}: abartılı veya doğrulanamayan ifade kullanılamaz: "${ifade}".`);
  }

  const bilinen = ilanMetinleri(ilan);
  for (const ozellik of OZELLIK_SOZLUGU) {
    if (kokDeseni(ozellik).test(kucuk) && !bilinen.includes(ozellik)) {
      hatalar.push(`${yer}: ilanda olmayan bir özellikten söz ediliyor: "${ozellik}".`);
    }
  }

  for (const { kok, alan } of onaysizKokler(ilan)) {
    if (kokDeseni(kok).test(kucuk)) hatalar.push(`${yer}: onaylı olmayan veya ilanda olmayan bilgi (${alan}) kullanılamaz: "${kok}".`);
  }

  if (ilan.konum.onayli) {
    for (const ad of new Set([ilan.konum.mahalle, ilan.konum.ilce, ilan.konum.il])) {
      if (kokDeseni(kucult(ad)).test(kucuk)) {
        hatalar.push(`${yer}: konum adı ("${ad}") doğrudan yazılamaz, {{konum}} yer tutucusunu kullanın.`);
      }
    }
  }
  for (const [kok, oneri] of KRITIK_KOKLER) {
    if (kokDeseni(kok).test(kucuk)) hatalar.push(`${yer}: "${kok}" doğrudan yazılamaz; ${oneri}.`);
  }

  const odaYazisi = kucult(ilan.odaSayisi.split("+").map((s) => sayiKelimesi(Number(s)) ?? s).join(" artı "));
  for (const eslesme of kucuk.matchAll(/(\p{L}+)\s+artı\s+(\p{L}+)/gu)) {
    if (`${eslesme[1]} artı ${eslesme[2]}` !== odaYazisi) {
      hatalar.push(`${yer}: oda sayısı ilandakinden farklı: "${eslesme[0]}" (ilanda "${odaYazisi}").`);
    }
  }

  const izinli = izinliSayiKelimeleri([
    ...ilan.odaSayisi.split("+").map(Number),
    ilan.bulunduguKat,
    ilan.katSayisi,
    ilan.binaYasi,
  ]);
  const kelimeler = kucuk.split(/[^\p{L}]+/u).filter(Boolean);
  for (const k of new Set(kelimeler)) {
    if (TUM_SAYI_KELIMELERI.has(k) && !izinli.has(k)) {
      hatalar.push(`${yer}: ilanda karşılığı olmayan sayı kullanılamaz: "${k}".`);
    }
  }
  return hatalar;
}

export type SenaryoDogrulamaSonucu = { senaryo: YzSenaryo; hatalar: [] } | { senaryo: null; hatalar: string[] };

/** Yapay zeka çıktısını, kullanılmadan önce koddaki kurallarla denetler. Hata yoksa senaryoyu döner. */
export function senaryoyuDogrula(cikti: unknown, baglam: DogrulamaBaglami): SenaryoDogrulamaSonucu {
  const sema = yzSenaryoSemasi.safeParse(cikti, { error: turkceHataHaritasi });
  if (!sema.success) {
    return { senaryo: null, hatalar: sema.error.issues.map((s) => `Şema: ${alanYolu(s.path, "çıktı")}: ${s.message}`) };
  }
  const senaryo = sema.data;
  const { ilan, tablo } = baglam;
  const hatalar: string[] = [];
  const { sahneler } = senaryo;

  if (sahneler.length < SAHNE_SINIRI.en_az || sahneler.length > SAHNE_SINIRI.en_fazla) {
    hatalar.push(`Sahne sayısı ${SAHNE_SINIRI.en_az}-${SAHNE_SINIRI.en_fazla} arasında olmalı (şu an ${sahneler.length}).`);
  }

  const fotograflar = new Set(ilan.fotograflar.map((f) => f.dosya));
  for (const [i, sahne] of sahneler.entries()) {
    const yer = `Sahne ${i + 1}`;
    if (!fotograflar.has(sahne.fotograf)) hatalar.push(`${yer}: "${sahne.fotograf}" fotoğraf listesinde yok.`);
    if (!sahne.baslik.trim()) hatalar.push(`${yer}: başlık boş.`);
    if (!sahne.disSes.trim()) hatalar.push(`${yer}: dış ses metni boş.`);
    if (!sahne.ekranMetni.trim()) hatalar.push(`${yer}: ekran metni boş.`);

    const baslikHatalari = metniDenetle(sahne.baslik, `${yer} başlık`, "baslik", baglam);
    hatalar.push(...baslikHatalari, ...metniDenetle(sahne.disSes, `${yer} dış ses`, "disSes", baglam));
    if (baslikHatalari.length === 0) {
      const ekranBasligi = yerTutuculariDoldur(sahne.baslik, tablo, "ekran");
      if ([...ekranBasligi].length > BASLIK_EN_FAZLA_KARAKTER) {
        hatalar.push(`${yer} başlık: en fazla ${BASLIK_EN_FAZLA_KARAKTER} karakter olmalı (şu an ${[...ekranBasligi].length}).`);
      }
    }

    // Ekran metninde telefon serbesttir; diğer kurallar başlıkla aynıdır.
    const ekranHatalari = metniDenetle(sahne.ekranMetni, `${yer} ekran metni`, "baslik", baglam);
    hatalar.push(...ekranHatalari);
    if (ekranHatalari.length === 0) {
      const ekran = yerTutuculariDoldur(sahne.ekranMetni, tablo, "ekran");
      if ([...ekran].length > EKRAN_METNI_EN_FAZLA_KARAKTER) {
        hatalar.push(`${yer} ekran metni: en fazla ${EKRAN_METNI_EN_FAZLA_KARAKTER} karakter olmalı (şu an ${[...ekran].length}).`);
      }
      const sade = (m: string) => kucult(m).replace(/[^\p{L}\p{N}{}]+/gu, " ").trim();
      if (sade(sahne.ekranMetni) === sade(sahne.baslik) || sade(sahne.ekranMetni) === sade(sahne.disSes)) {
        hatalar.push(`${yer} ekran metni: başlığı veya dış sesi tekrar etmemeli; sahnenin öne çıkan bilgisini kısaca özetlemeli.`);
      }
    }
  }

  const toplam = sahneler.reduce((t, s) => t + kelimeSayisi(s.disSes), 0);
  if (toplam < KELIME_SINIRI.en_az || toplam > KELIME_SINIRI.en_fazla) {
    hatalar.push(`Dış seslerin toplamı ${KELIME_SINIRI.en_az}-${KELIME_SINIRI.en_fazla} kelime olmalı (şu an ${toplam}).`);
  }

  const son = sahneler.at(-1);
  if (son) {
    if (tablo.fiyat && !`${son.baslik} ${son.disSes}`.includes("{{fiyat}}")) {
      hatalar.push("Son sahne: fiyat {{fiyat}} yer tutucusuyla yer almalı.");
    }
    if (!kucult(son.disSes).includes(kucult(ilan.emlakOfisi))) {
      hatalar.push(`Son sahne: dış seste iletişim için "${ilan.emlakOfisi}" adı geçmeli (ör. "${ilan.emlakOfisi}'u arayın").`);
    }
  }

  return hatalar.length === 0 ? { senaryo, hatalar: [] } : { senaryo: null, hatalar };
}
