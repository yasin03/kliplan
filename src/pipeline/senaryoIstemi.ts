import type { Ilan } from "../schema/ilan.js";
import { sayiKelimesi, siraKelimesi } from "./sayilar.js";
import { BASLIK_EN_FAZLA_KARAKTER, KELIME_SINIRI, SAHNE_SINIRI, YASAKLI_IFADELER } from "./senaryoDogrulama.js";
import type { YerTutucu, YerTutucuDegeri } from "./yerTutucu.js";

/**
 * Yapay zekaya verilen bilgiler. Kritik değerler (fiyat, telefon, metrekare, konum, kira,
 * yetki belgesi) burada yer almaz; yalnızca hangi yer tutucuların kullanılabileceği söylenir.
 * Onaysız bilgiler hiç gönderilmez. Sayılar yazıyla verilir.
 */
export type YzGirdisi = {
  emlakOfisi: string;
  odaSayisi: string;
  bina: string[];
  ozellikler: string[];
  kullanilabilirYerTutucular: Record<string, string>;
  fotograflar: { dosya: string; tur: string }[];
};

const YER_TUTUCU_ACIKLAMALARI: Record<YerTutucu, string> = {
  fiyat: "satış fiyatı",
  netM2: "net kullanım alanı",
  konum: "mahalle, ilçe ve il",
  telefon: "telefon numarası (yalnızca başlıkta; dış seste kullanılamaz)",
};

export function yzGirdisiOlustur(ilan: Ilan, tablo: Partial<Record<YerTutucu, YerTutucuDegeri>>): YzGirdisi {
  const odalar = ilan.odaSayisi.split("+").map((s) => sayiKelimesi(Number(s)) ?? s);
  const bina: string[] = [];
  if (ilan.binaYasi === 0) bina.push("Bina sıfır (yeni yapılmış).");
  const kat = siraKelimesi(ilan.bulunduguKat);
  const katSayisi = sayiKelimesi(ilan.katSayisi);
  if (kat && katSayisi) bina.push(`Daire, ${katSayisi} katlı binanın ${kat} katında.`);
  else if (ilan.bulunduguKat === 0) bina.push("Daire zemin katta.");
  if (ilan.isitma) bina.push(`Isıtma: ${ilan.isitma}.`);
  if (ilan.mutfak) bina.push(`Mutfak: ${ilan.mutfak}.`);
  if (ilan.esyali) bina.push("Daire eşyalı.");
  if (ilan.krediyeUygun) bina.push("Krediye uygun.");
  if (ilan.tapu) bina.push(`Tapu: ${ilan.tapu}.`);
  if (ilan.kiraDurumu?.onayli) bina.push(`Kullanım durumu: ${ilan.kiraDurumu.aciklama}.`);

  return {
    emlakOfisi: ilan.emlakOfisi,
    odaSayisi: odalar.join(" artı "),
    bina,
    ozellikler: ilan.ozellikler,
    kullanilabilirYerTutucular: Object.fromEntries(
      (Object.keys(tablo) as YerTutucu[]).map((ad) => [`{{${ad}}}`, YER_TUTUCU_ACIKLAMALARI[ad]]),
    ),
    fotograflar: ilan.fotograflar.map(({ dosya, tur }) => ({ dosya, tur })),
  };
}

export const SISTEM_METNI = `Bir emlak ofisi adına, sosyal medyada paylaşılacak 20-30 saniyelik dikey bir ilan videosunun sahnelerini yazıyorsun. Videoyu izleyen kişi daireyle ilgilenebilecek biri; metin ona güvenilir bir danışman gibi, sade ve doğal Türkçeyle bilgi vermeli. Satış sloganı gibi değil, bilgi veren bir tonda yaz.

Her sahne bir fotoğraf, ekranda büyük yazılan kısa bir başlık ve seslendirilecek bir dış ses cümlesinden oluşur.

İçerik kuralları:
- Yalnızca sana verilen bilgileri kullan. Verilmeyen hiçbir özelliği, mesafeyi, çevre bilgisini veya niteliği (geniş, ferah, aydınlık gibi) yazma; bunları kod tarafında doğrulayamıyoruz.
- Abartılı veya doğrulanamayan ifadeler kullanma: ${YASAKLI_IFADELER.slice(0, 16).join(", ")} ve benzerleri.
- Hiç rakam kullanma. Oda ve kat gibi sayıları sana verildiği gibi yazıyla yaz.
- Fiyat, telefon, metrekare ve konumu asla kendin yazma; yalnızca listede verilen yer tutucuları birebir kullan. Yer tutucuya ek getirme ("{{konum}}'da" değil, "{{konum}} konumunda"; "{{fiyat}}'a" değil, "fiyatı {{fiyat}}").
- {{telefon}} dış seste kullanılmaz. İletişim için son sahnenin dış sesinde emlak ofisinin adıyla aranmasını iste (ör. "Ayrıntılar için <ofis adı>'nı arayın").

Yapı kuralları:
- ${SAHNE_SINIRI.en_az}-${SAHNE_SINIRI.en_fazla} sahne. Tüm dış seslerin toplamı ${KELIME_SINIRI.en_az}-${KELIME_SINIRI.en_fazla} kelime (yer tutucular bir kelime sayılır). Bir sahnenin dış sesi bir, en fazla iki kısa cümle olsun.
- İlk cümle dikkat çekici ama abartısız olsun; dairenin en belirgin gerçek özelliğiyle başla.
- Başlıklar en fazla ${BASLIK_EN_FAZLA_KARAKTER} karakter, iki-dört kelime.
- Her sahneye içeriğine uygun türde bir fotoğraf seç; dosya adını listeden birebir yaz. Aynı fotoğrafı art arda kullanma.
- Son sahnede fiyatı {{fiyat}} ile ver ve iletişim için ofisin aranmasını iste.`;

export type Duzeltme = { oncekiCikti: unknown; hatalar: string[] };

export function kullaniciMetni(girdi: YzGirdisi, duzeltme?: Duzeltme): string {
  const metin = `İlan bilgileri:\n${JSON.stringify(girdi, null, 2)}`;
  if (!duzeltme) return metin;
  return `${metin}

Önceki çıktın kod tarafındaki kontrollerden geçemedi:
${JSON.stringify(duzeltme.oncekiCikti, null, 2)}

Bulunan hatalar:
${duzeltme.hatalar.map((h) => `- ${h}`).join("\n")}

Bu hataların hepsini düzelterek senaryoyu baştan yaz. Diğer kuralları da korumaya devam et.`;
}
