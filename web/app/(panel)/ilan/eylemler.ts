"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { kontrolMaddeleri } from "@cekirdek/pipeline/kontrolListesi.js";
import { duzenlenenSenaryo, SenaryoHatasi, type SenaryoSonucu } from "@cekirdek/pipeline/senaryoUretimi.js";
import { iletisimBilgisi } from "@cekirdek/pipeline/videoProps.js";
import { temaAdiMi } from "@cekirdek/remotion/temalar.js";
import { DuzenlemeHatasi, type IlanGorunumSecimi } from "@cekirdek/veri/depo.js";
import { SECIMLER } from "@cekirdek/veri/gorunum.js";
import { type AlanHatalari, type FormAlanlari, fotografTuruMu, ilanFormunuDogrula } from "@cekirdek/veri/ilanFormu.js";
import { type IsTuru, isEkle } from "@cekirdek/worker/kuyruk.js";
import { kullaniciMesaji } from "@/lib/hatalar";
import { ilanBaglami } from "@/lib/ilanBaglami";
import { kuyruk } from "@/lib/kuyruk";
import { girisGerekli } from "@/lib/oturum";

export type FormDurumu = { hatalar: AlanHatalari; mesaj: string | null; degerler: FormAlanlari };
export type EylemSonucu = { hata: string | null };

const formAlanlari = (form: FormData): FormAlanlari =>
  Object.fromEntries([...form.entries()].filter(([ad, d]) => typeof d === "string" && !ad.startsWith("$ACTION")).map(([ad, d]) => [ad, d as string]));

/** Formdaki "Görünüm" bölümü: "" şirket varsayılanı, "yok", veya kimlik. Bölüm gösterilmediyse (admin yeni ilan) `undefined`. */
function gorunumSecimiFormdan(d: FormAlanlari): IlanGorunumSecimi | undefined {
  if (d["gorunum.muzik"] === undefined && d["gorunum.resim"] === undefined && d["gorunum.tema"] === undefined) return undefined;
  const secim = (deger: string | undefined) =>
    !deger ? { secim: "ofis" as const, id: null } : deger === "yok" ? { secim: "yok" as const, id: null } : { secim: "secili" as const, id: deger };
  const muzik = secim(d["gorunum.muzik"]);
  const resim = secim(d["gorunum.resim"]);
  const tema = d["gorunum.tema"];
  return { tema: temaAdiMi(tema) ? tema : null, muzikSecimi: muzik.secim, muzikId: muzik.id, resimSecimi: resim.secim, resimId: resim.id };
}

/** Bilinen hatayı mesaja çevirir; beklenmeyen hata Next.js'in hata sayfasına gider ve loglanır. */
async function eylem(is: () => Promise<void>): Promise<EylemSonucu> {
  try {
    await is();
  } catch (hata) {
    const mesaj = kullaniciMesaji(hata);
    if (!mesaj) throw hata;
    return { hata: mesaj };
  }
  refresh();
  return { hata: null };
}

/** Yeni ilan (`ilanId` boş) veya mevcut ilanın bilgileri. Hata varsa girilen değerler geri döner, form boşalmaz. */
export async function ilanKaydet(ilanId: string | null, _onceki: FormDurumu, form: FormData): Promise<FormDurumu> {
  const { depo, yetki } = await girisGerekli();
  const degerler = formAlanlari(form);
  const sonuc = ilanFormunuDogrula(degerler);
  if (!sonuc.basarili) {
    return { hatalar: sonuc.hatalar, mesaj: "Bazı alanlar eksik veya hatalı. İşaretli alanları düzeltin.", degerler };
  }

  const gorunum = gorunumSecimiFormdan(degerler);
  let hedef: string;
  try {
    if (ilanId) {
      await depo.ilanBilgileriniKaydet(ilanId, sonuc.veri);
      if (gorunum) await depo.ilanGorunumunuKaydet(ilanId, gorunum);
      hedef = `/ilan/${ilanId}`;
    } else {
      let ofisId: string | undefined;
      if (yetki.admin) {
        ofisId = (await depo.ofisler()).find((o) => o.id === degerler.ofisId)?.id;
        if (!ofisId) return { hatalar: { ofisId: "Ofis seçin." }, mesaj: "İlanın hangi ofise ait olduğunu seçin.", degerler };
      }
      const kayit = await depo.ilanOlustur(sonuc.veri, ofisId, gorunum);
      hedef = `/ilan/${kayit.id}/fotograflar`;
    }
  } catch (hata) {
    const mesaj = kullaniciMesaji(hata);
    if (!mesaj) throw hata;
    return { hatalar: {}, mesaj, degerler };
  }
  redirect(hedef);
}

export async function ilanSil(ilanId: string): Promise<EylemSonucu> {
  const { depo } = await girisGerekli();
  const sonuc = await eylem(() => depo.ilanSil(ilanId));
  if (!sonuc.hata) redirect("/");
  return sonuc;
}

export async function fotografTuruDegistir(fotografId: string, tur: string): Promise<EylemSonucu> {
  const { depo } = await girisGerekli();
  if (!fotografTuruMu(tur)) return { hata: "Geçersiz fotoğraf türü." };
  return eylem(() => depo.fotografTuruDegistir(fotografId, tur));
}

export async function fotografSil(fotografId: string): Promise<EylemSonucu> {
  const { depo } = await girisGerekli();
  return eylem(() => depo.fotografSil(fotografId));
}

export async function fotograflariSirala(ilanId: string, siralama: string[]): Promise<EylemSonucu> {
  const { depo } = await girisGerekli();
  return eylem(() => depo.fotograflariSirala(ilanId, siralama));
}

/** Redis kapalıyken bağlantı sonsuza kadar yeniden denenir; kullanıcı beklemesin diye süre sınırı. */
const KUYRUK_SURESI_MS = 5000;

/** Senaryo veya video işini başlatır. `zorla`: önbelleği yok sayıp yapay zekaya yeni senaryo yazdırır (ücretli). */
export async function uretimBaslat(ilanId: string, tur: IsTuru, zorla = false): Promise<EylemSonucu> {
  const { depo } = await girisGerekli();
  if (tur !== "senaryo" && tur !== "video") return { hata: "Geçersiz iş türü." };
  return eylem(async () => {
    const { ilan, json } = await ilanBaglami(depo, ilanId);
    if (!json.basarili) throw new DuzenlemeHatasi(`Önce şunları tamamlayın: ${json.hatalar.join(" ")}`);
    // Worker da denetler; burada kuyruğa girmeden, panelin diliyle söylenir (ör. şirket adı değişti, senaryo eski adı içeriyor).
    if (tur === "video" && ilan.senaryo) {
      try {
        duzenlenenSenaryo(ilan.senaryo as SenaryoSonucu, json.ilan, (ilan.senaryo as SenaryoSonucu).senaryo);
      } catch (hata) {
        if (!(hata instanceof SenaryoHatasi)) throw hata;
        throw new DuzenlemeHatasi(`Senaryo güncel değil (ör. şirket adı veya ilan bilgisi değişti): ${hata.hatalar.join(" ")} Senaryoyu düzenleyin veya yeniden üretin.`);
      }
    }

    const is = await depo.uretimBaslat(ilanId, tur, zorla === true);
    let sayac: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        isEkle(kuyruk(), is.id, tur),
        new Promise((_, reddet) => {
          sayac = setTimeout(() => reddet(new Error("Kuyruğa ulaşılamadı (zaman aşımı).")), KUYRUK_SURESI_MS);
        }),
      ]);
    } catch (hata) {
      console.error("İş kuyruğa eklenemedi:", hata);
      const cozum = "Biraz sonra yeniden deneyin. Sürerse yöneticiye haber verin.";
      await depo.isBasarisiz(is.id, { adim: "Kuyruk", mesaj: "İş kuyruğa eklenemedi.", cozum });
      throw new DuzenlemeHatasi(`İş başlatılamadı. ${cozum}`);
    } finally {
      clearTimeout(sayac);
    }
  });
}

/** Son başarısız işi aynı türle yeniden kuyruğa koyar. Tamamlanan adımlar önbellekten gelir. */
export async function yenidenDene(ilanId: string): Promise<EylemSonucu> {
  const { depo } = await girisGerekli();
  const son = await depo.sonIs(ilanId);
  if (!son) return { hata: "Yeniden denenecek iş yok." };
  return uretimBaslat(ilanId, son.tur);
}

export type SenaryoKaydiSonucu = { hatalar: string[] };

/** Düzenlenen senaryo, yapay zeka çıktısıyla aynı kurallardan geçmezse kaydedilmez. */
export async function senaryoKaydet(ilanId: string, yeni: unknown): Promise<SenaryoKaydiSonucu> {
  const { depo } = await girisGerekli();
  try {
    const { ilan, json } = await ilanBaglami(depo, ilanId);
    if (!json.basarili) return { hatalar: json.hatalar };
    if (!ilan.senaryo) return { hatalar: ["Bu ilan için kayıtlı senaryo yok. Önce senaryoyu üretin."] };
    await depo.senaryoKaydet(ilanId, duzenlenenSenaryo(ilan.senaryo as SenaryoSonucu, json.ilan, yeni));
  } catch (hata) {
    if (hata instanceof SenaryoHatasi) return { hatalar: hata.hatalar };
    const mesaj = kullaniciMesaji(hata);
    if (!mesaj) throw hata;
    return { hatalar: [mesaj] };
  }
  refresh();
  return { hatalar: [] };
}

/** Kontrol listesinin bütün maddeleri işaretlenmeden onay verilmez; maddeler sunucuda yeniden hesaplanır. */
export async function videoOnayla(ilanId: string, videoId: string, isaretlenenler: string[]): Promise<EylemSonucu> {
  const { depo } = await girisGerekli();
  return eylem(async () => {
    const { json } = await ilanBaglami(depo, ilanId);
    if (!json.basarili) throw new DuzenlemeHatasi(`İlan bilgileri eksik: ${json.hatalar.join(" ")}`);
    if (!(await depo.videolar(ilanId)).some((v) => v.id === videoId)) throw new DuzenlemeHatasi("Video bu ilana ait değil.");
    const maddeler = kontrolMaddeleri(json.ilan, iletisimBilgisi(json.ilan));
    const eksik = maddeler.filter((m) => !isaretlenenler.includes(m.kod));
    if (eksik.length) throw new DuzenlemeHatasi(`Onaylamak için bütün maddeleri işaretleyin (${eksik.length} madde eksik).`);
    await depo.videoOnayla(videoId, maddeler.map((m) => m.metin));
  });
}

/** İlanın teması (boşsa şirket varsayılanı), müziği ve kapanış resmi. Değişirse ilan taslağa döner; senaryo korunur. */
export async function ilanGorunumuKaydet(ilanId: string, secim: IlanGorunumSecimi): Promise<EylemSonucu> {
  const { depo } = await girisGerekli();
  if (secim.tema !== null && !temaAdiMi(secim.tema)) return { hata: "Geçersiz tema." };
  if (!SECIMLER.includes(secim.muzikSecimi) || (secim.resimSecimi !== undefined && !SECIMLER.includes(secim.resimSecimi))) return { hata: "Geçersiz seçim." };
  return eylem(() =>
    depo.ilanGorunumunuKaydet(ilanId, {
      tema: secim.tema,
      muzikSecimi: secim.muzikSecimi,
      muzikId: secim.muzikId ?? null,
      resimSecimi: secim.resimSecimi,
      resimId: secim.resimId ?? null,
    }),
  );
}
