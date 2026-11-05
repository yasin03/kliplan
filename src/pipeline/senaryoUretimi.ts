import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { toplamKareSayisi } from "../remotion/hesap.js";
import { tema } from "../remotion/tema.js";
import type { Sahne } from "../remotion/tipler.js";
import type { ApiKullanimi, ScriptProvider } from "../providers/ScriptProvider.js";
import type { Ilan } from "../schema/ilan.js";
import type { YzSenaryo } from "../schema/senaryo.js";
import { senaryoyuDogrula } from "./senaryoDogrulama.js";
import { type Duzeltme, kullaniciMetni, SISTEM_METNI, yzGirdisiOlustur } from "./senaryoIstemi.js";
import { type YerTutucu, type YerTutucuDegeri, yerTutuculariBul, yerTutuculariDoldur, yerTutucuTablosu } from "./yerTutucu.js";

export class SenaryoHatasi extends Error {
  constructor(
    mesaj: string,
    readonly hatalar: string[],
  ) {
    super(mesaj);
  }
}

export type DenemeKaydi = { sira: number; hatalar: string[]; kullanim?: ApiKullanimi | undefined };

export type SenaryoSonucu = {
  /** Yapay zekanın yer tutuculu, doğrulanmış çıktısı. */
  senaryo: YzSenaryo;
  /** Değerleri yerleştirilmiş, videoya hazır sahneler. */
  sahneler: Sahne[];
  /** Metinde kullanılan kritik bilgiler ve kaynak alanları. */
  kullanilanYerTutucular: (YerTutucuDegeri & { ad: YerTutucu })[];
  denemeler: DenemeKaydi[];
  toplamMaliyetUsd: number;
  onbellektenMi: boolean;
  saglayici: string;
  /** Yapay zeka çıktısı sonradan elle düzenlendiyse `true`. */
  duzenlendi: boolean;
};

/** Türkçe dış ses için ortalama konuşma hızı (kelime/saniye). Faz 4'te gerçek ses süresi kullanılacak. */
const KONUSMA_HIZI = 2.5;
const KAPANIS_EK_SURE = 2;
const SURE_SINIRI = { en_az: 20, en_fazla: 29.5 };

/** Sahne sürelerini dış ses uzunluğundan tahmin eder; toplamı 20-30 saniye aralığına ölçekler. */
export function sureleriTahminEt(sesMetinleri: string[]): number[] {
  const ham = sesMetinleri.map((metin, i) => {
    const kelime = metin.split(/\s+/).filter(Boolean).length;
    const sure = Math.max(3, kelime / KONUSMA_HIZI + 0.7);
    return i === sesMetinleri.length - 1 ? sure + KAPANIS_EK_SURE : sure;
  });
  const toplam = toplamKareSayisi(ham.map((sureSn) => ({ sureSn }))) / tema.video.fps;
  const gecisSn = ((ham.length - 1) * tema.hareket.gecisKare) / tema.video.fps;
  const hedef = Math.min(SURE_SINIRI.en_fazla, Math.max(SURE_SINIRI.en_az, toplam));
  const oran = (hedef + gecisSn) / (toplam + gecisSn);
  return ham.map((s) => Math.min(10, Math.round(s * oran * 10) / 10));
}

type Tablo = Partial<Record<YerTutucu, YerTutucuDegeri>>;

export function sahnelereDonustur(senaryo: YzSenaryo, tablo: Tablo): Sahne[] {
  const sesler = senaryo.sahneler.map((s) => yerTutuculariDoldur(s.disSes, tablo, "ses"));
  const sureler = sureleriTahminEt(sesler);
  return senaryo.sahneler.map((s, i) => ({
    fotograf: s.fotograf,
    baslik: yerTutuculariDoldur(s.baslik, tablo, "ekran"),
    disSes: sesler[i]!,
    altyazi: yerTutuculariDoldur(s.ekranMetni, tablo, "ekran"),
    sureSn: sureler[i]!,
  }));
}

function sonucKur(
  senaryo: YzSenaryo,
  tablo: Tablo,
  bilgi: Pick<SenaryoSonucu, "denemeler" | "onbellektenMi" | "saglayici" | "duzenlendi">,
): SenaryoSonucu {
  const adlar = new Set(senaryo.sahneler.flatMap((s) => yerTutuculariBul(`${s.baslik} ${s.disSes}`)) as YerTutucu[]);
  return {
    ...bilgi,
    senaryo,
    sahneler: sahnelereDonustur(senaryo, tablo),
    kullanilanYerTutucular: [...adlar].map((ad) => ({ ad, ...tablo[ad]! })),
    toplamMaliyetUsd: bilgi.denemeler.reduce((t, d) => t + (d.kullanim?.tahminiMaliyetUsd ?? 0), 0),
  };
}

/**
 * Kullanıcının düzenlediği (veya veritabanından geri okunan) senaryoyu yapay zeka çıktısıyla aynı
 * kurallardan geçirir. Kurallara uymazsa `SenaryoHatasi` fırlatır; kritik bilgiler yine yer tutucuyla kalır.
 */
export function duzenlenenSenaryo(onceki: SenaryoSonucu, ilan: Ilan, yeni: unknown): SenaryoSonucu {
  const tablo = yerTutucuTablosu(ilan);
  const sonuc = senaryoyuDogrula(yeni, { ilan, tablo });
  if (!sonuc.senaryo) {
    throw new SenaryoHatasi(`Düzenlenen senaryo kurallara uymuyor:\n${sonuc.hatalar.map((h) => `  - ${h}`).join("\n")}`, sonuc.hatalar);
  }
  const degisti = JSON.stringify(sonuc.senaryo) !== JSON.stringify(onceki.senaryo);
  const { denemeler, onbellektenMi, saglayici } = onceki;
  return sonucKur(sonuc.senaryo, tablo, { denemeler, onbellektenMi, saglayici, duzenlendi: onceki.duzenlendi || degisti });
}

type UretimSecenekleri = {
  ilan: Ilan;
  saglayici: ScriptProvider;
  /** Verilirse geçerli çıktı bu klasöre içerik özetiyle kaydedilir ve tekrar kullanılır. */
  onbellekKlasoru?: string | undefined;
  /** Önbelleği yok sayar. */
  zorla?: boolean | undefined;
  enFazlaYenidenDeneme?: number;
  bildir?: (mesaj: string) => void;
};

export async function senaryoUret(secenekler: UretimSecenekleri): Promise<SenaryoSonucu> {
  const { ilan, saglayici, bildir = () => {} } = secenekler;
  const enFazlaYenidenDeneme = secenekler.enFazlaYenidenDeneme ?? 2;
  const tablo = yerTutucuTablosu(ilan);
  const baglam = { ilan, tablo };
  const girdi = yzGirdisiOlustur(ilan, tablo);
  const kullanici = kullaniciMetni(girdi);

  const anahtar = createHash("sha256").update(JSON.stringify([saglayici.kimlik, SISTEM_METNI, kullanici])).digest("hex");
  const onbellekYolu = secenekler.onbellekKlasoru
    ? path.join(secenekler.onbellekKlasoru, `senaryo-${anahtar.slice(0, 16)}.json`)
    : undefined;

  const bilgi = (denemeler: DenemeKaydi[], onbellektenMi: boolean) => ({ denemeler, onbellektenMi, saglayici: saglayici.kimlik, duzenlendi: false });

  if (onbellekYolu && !secenekler.zorla) {
    try {
      const kayit = JSON.parse(await readFile(onbellekYolu, "utf8")) as { cikti: unknown };
      // Kurallar sonradan sıkılaşmış olabilir; önbellekteki çıktı da yeniden denetlenir.
      const sonuc = senaryoyuDogrula(kayit.cikti, baglam);
      if (sonuc.senaryo) {
        bildir("Senaryo önbellekten alındı, API çağrısı yapılmadı.");
        return sonucKur(sonuc.senaryo, tablo, bilgi([], true));
      }
    } catch {
      // Önbellek yok veya okunamadı.
    }
  }

  const denemeler: DenemeKaydi[] = [];
  let duzeltme: Duzeltme | undefined;
  for (let sira = 1; sira <= enFazlaYenidenDeneme + 1; sira++) {
    bildir(sira === 1 ? `Senaryo üretiliyor (${saglayici.kimlik})…` : `Hatalar modele bildirildi, yeniden deneniyor (${sira - 1}/${enFazlaYenidenDeneme})…`);
    const yanit = await saglayici.senaryoUret({
      sistem: SISTEM_METNI,
      kullanici: kullaniciMetni(girdi, duzeltme),
      girdi,
      duzeltme,
    });
    const sonuc = senaryoyuDogrula(yanit.cikti, baglam);
    denemeler.push({ sira, hatalar: sonuc.hatalar, kullanim: yanit.kullanim });

    if (sonuc.senaryo) {
      if (onbellekYolu) {
        await mkdir(path.dirname(onbellekYolu), { recursive: true });
        await writeFile(onbellekYolu, JSON.stringify({ saglayici: saglayici.kimlik, cikti: sonuc.senaryo }, null, 2));
      }
      return sonucKur(sonuc.senaryo, tablo, bilgi(denemeler, false));
    }
    for (const h of sonuc.hatalar) bildir(`  ✗ ${h}`);
    duzeltme = { oncekiCikti: yanit.cikti, hatalar: sonuc.hatalar };
  }

  const son = denemeler.at(-1)?.hatalar ?? [];
  throw new SenaryoHatasi(
    `Yapay zeka ${denemeler.length} denemede kurallara uygun senaryo üretemedi. Son denemedeki hatalar:\n${son.map((h) => `  - ${h}`).join("\n")}`,
    son,
  );
}
