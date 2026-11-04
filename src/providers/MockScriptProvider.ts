import { EKRAN_METNI_EN_FAZLA_KARAKTER, KELIME_SINIRI, kelimeSayisi } from "../pipeline/senaryoDogrulama.js";
import type { YzGirdisi } from "../pipeline/senaryoIstemi.js";
import type { YzSenaryo } from "../schema/senaryo.js";
import type { SaglayiciYaniti, ScriptProvider, SenaryoIstegi } from "./ScriptProvider.js";

/** Özel adlara belirtme hali eki: "Temurlar Grup" → "Temurlar Grup'u", "Ada Emlak" → "Ada Emlak'ı". */
export function belirtmeHali(ad: string): string {
  const unluler = [...ad.toLocaleLowerCase("tr-TR")].filter((h) => "aeıioöuü".includes(h));
  const son = unluler.at(-1) ?? "e";
  const ek = { a: "ı", ı: "ı", e: "i", i: "i", o: "u", u: "u", ö: "ü", ü: "ü" }[son] ?? "i";
  const unluyleBitiyor = "aeıioöuü".includes(ad.toLocaleLowerCase("tr-TR").at(-1) ?? "");
  return `${ad}'${unluyleBitiyor ? "y" : ""}${ek}`;
}

const kucukBaslat = (metin: string) => metin.charAt(0).toLocaleLowerCase("tr-TR") + metin.slice(1);
const buyukBaslat = (metin: string) => metin.charAt(0).toLocaleUpperCase("tr-TR") + metin.slice(1);

/** Ekran metni sınırı aşılırsa sondan öğe atılarak kısaltılır; tek öğe bile sığmazsa yedek kullanılır. */
function ekranMetni(ogeler: string[], yedek: string): string {
  const liste = ogeler.filter(Boolean).map(buyukBaslat);
  while (liste.length > 0) {
    const metin = liste.join(" · ");
    if ([...metin].length <= EKRAN_METNI_EN_FAZLA_KARAKTER) return metin;
    liste.pop();
  }
  return yedek;
}

function listele(ogeler: string[]): string {
  const k = ogeler.map(kucukBaslat);
  return k.length <= 1 ? (k[0] ?? "") : `${k.slice(0, -1).join(", ")} ve ${k.at(-1)}`;
}

/**
 * API anahtarı olmadan çalışan, ilan verisinden kalıp cümlelerle senaryo kuran sağlayıcı.
 * Testlerde `yanitlar` ile sırayla döndürülecek hazır (hatalı da olabilen) çıktılar verilebilir.
 */
export class MockScriptProvider implements ScriptProvider {
  readonly kimlik = "mock:v1";
  readonly ucretli = false;
  readonly istekler: SenaryoIstegi[] = [];
  private readonly yanitlar: unknown[];

  constructor(secenekler: { yanitlar?: unknown[] } = {}) {
    this.yanitlar = [...(secenekler.yanitlar ?? [])];
  }

  senaryoUret(istek: SenaryoIstegi): Promise<SaglayiciYaniti> {
    this.istekler.push(istek);
    const cikti = this.yanitlar.length > 0 ? this.yanitlar.shift() : kalipSenaryo(istek.girdi);
    return Promise.resolve({ cikti });
  }
}

export function kalipSenaryo(girdi: YzGirdisi): YzSenaryo {
  const yerTutucu = (ad: string) => `{{${ad}}}` in girdi.kullanilabilirYerTutucular;
  const fotolar = girdi.fotograflar;
  const kullanilan = new Set<string>();
  let sonSecilen: string | undefined;
  /**
   * Türleri verilen sırayla dener; hiçbiri kalmadıysa kullanılmamış ilk fotoğrafı alır.
   * Fotoğraflar biterse baştan başlanır, ama aynı fotoğraf art arda gelmez.
   */
  const sec = (...turler: string[]) => {
    if (fotolar.every((f) => kullanilan.has(f.dosya))) {
      kullanilan.clear();
      if (sonSecilen && fotolar.length > 1) kullanilan.add(sonSecilen);
    }
    const bulunan =
      turler.map((tur) => fotolar.find((f) => f.tur === tur && !kullanilan.has(f.dosya))).find(Boolean) ??
      fotolar.find((f) => !kullanilan.has(f.dosya));
    const dosya = (bulunan ?? fotolar[0])!.dosya;
    kullanilan.add(dosya);
    sonSecilen = dosya;
    return dosya;
  };
  const bilgi = (bas: string) => girdi.bina.find((b) => b.startsWith(bas));
  /** "Mutfak: Açık Amerikan mutfak." → "açık Amerikan mutfak" */
  const deger = (bas: string) => {
    const b = bilgi(bas);
    return b ? kucukBaslat(b.slice(bas.length).trim().replace(/\.$/, "")) : undefined;
  };
  const sifir = girdi.bina.some((b) => b.startsWith("Bina sıfır"));

  const ilk = {
    fotograf: sec("bina", "dis_mekan"),
    baslik: sifir ? "Sıfır binada daire" : `${girdi.odaSayisi.charAt(0).toLocaleUpperCase("tr-TR")}${girdi.odaSayisi.slice(1)} daire`,
    disSes: `${yerTutucu("konum") ? "{{konum}} konumunda, " : ""}${sifir ? "yeni yapılmış bir binada " : ""}${girdi.odaSayisi} daire.`,
    ekranMetni: yerTutucu("konum") ? "{{konum}}" : ekranMetni([girdi.odaSayisi], "Daire"),
  };
  const ic = {
    fotograf: sec("salon"),
    baslik: "Salon",
    disSes: `${bilgi("Daire eşyalı") ? "Daire eşyalı olarak sunuluyor. " : ""}Net kullanım alanı {{netM2}}.`,
    ekranMetni: `${bilgi("Daire eşyalı") ? "Eşyalı · " : ""}Net {{netM2}}`,
  };
  const ara: YzSenaryo["sahneler"] = [];
  const mutfak = deger("Mutfak:");
  if (mutfak) {
    ara.push({ fotograf: sec("mutfak"), baslik: "Mutfak", disSes: `Mutfak, ${mutfak} olarak düzenlenmiş.`, ekranMetni: ekranMetni([mutfak], "Mutfak düzeni") });
  }
  const isitma = deger("Isıtma:");
  if (isitma) {
    ara.push({
      fotograf: sec("yatak_odasi", "salon"),
      baslik: "Isıtma",
      disSes: `Isıtma, ${isitma} ile sağlanıyor.`,
      ekranMetni: ekranMetni([isitma], "Isıtma sistemi"),
    });
  }

  const kredi = bilgi("Krediye uygun") ? "Daire krediye uygun. " : "";
  const son = {
    fotograf: sec("bina", "dis_mekan", "salon"),
    baslik: yerTutucu("fiyat") ? "Fiyat: {{fiyat}}" : "Bilgi ve randevu",
    disSes: `${yerTutucu("fiyat") ? "Fiyatı {{fiyat}}. " : ""}${kredi}Ayrıntılar için ${belirtmeHali(girdi.emlakOfisi)} arayın.`,
    ekranMetni: ekranMetni([yerTutucu("fiyat") ? "{{fiyat}}" : "", yerTutucu("telefon") ? "{{telefon}}" : girdi.emlakOfisi], girdi.emlakOfisi),
  };

  // Bina bilgisi eklenir, ardından özellikler dörtlü gruplar halinde, toplam kelime
  // alt sınıra ulaşana kadar ayrı sahnelere dağıtılır. Üst sınır hiçbir adımda aşılmaz.
  const ekler: YzSenaryo["sahneler"] = [];
  let toplam = [ilk, ic, ...ara, son].reduce((t, s) => t + kelimeSayisi(s.disSes), 0);
  const ekle = (baslik: string, disSes: string, ekran: string, ...turler: string[]) => {
    ekler.push({ fotograf: sec(...turler), baslik, disSes, ekranMetni: ekran });
    toplam += kelimeSayisi(disSes);
  };
  const sigar = (metin: string) => toplam + kelimeSayisi(metin) <= KELIME_SINIRI.en_fazla;

  const binaBilgisi = [bilgi("Daire,"), bilgi("Tapu:")].filter((b): b is string => Boolean(b)).join(" ");
  const tapu = deger("Tapu:");
  if (binaBilgisi && sigar(binaBilgisi)) {
    ekle("Bina ve tapu", binaBilgisi, ekranMetni([tapu ? `${tapu} tapu` : ""], "Bina bilgisi"), "salon", "koridor", "dis_mekan");
  }
  const kalan = [...girdi.ozellikler];
  const cumle = (ogeler: string[], ilkGrup: boolean) =>
    ilkGrup ? `Öne çıkan özellikler arasında ${listele(ogeler)} var.` : `Ayrıca ${listele(ogeler)} bulunuyor.`;
  for (let grup = 0; kalan.length > 0 && toplam < KELIME_SINIRI.en_az && grup < 2; grup++) {
    let adet = Math.min(4, kalan.length);
    while (adet > 1 && !sigar(cumle(kalan.slice(0, adet), grup === 0))) adet--;
    const ogeler = kalan.splice(0, adet);
    const metin = cumle(ogeler, grup === 0);
    if (!sigar(metin)) break;
    ekle(grup === 0 ? "Özellikler" : "Diğer özellikler", metin, ekranMetni(ogeler, "Öne çıkan özellikler"), "koridor", "banyo", "balkon", "salon");
  }

  // Bilgi az olduğunda alt sınıra, hiçbir iddia taşımayan nötr cümlelerle ulaşılır.
  const dolgular = [
    "Videoda dairenin bölümlerini sırayla görebilirsiniz.",
    "Daireyi yerinde görmek için randevu alabilirsiniz.",
    "Sorularınızı ofisimize iletebilirsiniz.",
  ];
  for (const dolgu of dolgular) {
    if (toplam >= KELIME_SINIRI.en_az || !sigar(dolgu)) break;
    ic.disSes = `${ic.disSes} ${dolgu}`;
    toplam += kelimeSayisi(dolgu);
  }

  return { sahneler: [ilk, ic, ...ara, ...ekler, son] };
}
