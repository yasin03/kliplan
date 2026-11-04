import * as sdk from "microsoft-cognitiveservices-speech-sdk";
import { SaglayiciHatasi } from "./ScriptProvider.js";
import type { KelimeZamani, SesIstegi, SesYaniti, TelaffuzSozlugu, TtsProvider } from "./TtsProvider.js";

export const VARSAYILAN_SES = "tr-TR-EmelNeural";

/** ABD doları / 1 milyon karakter, Neural sesler (Kasım 2026). HD seslerin fiyatı doğrulanmadı. Yalnızca tahmin içindir. */
const FIYAT = 15;

/** Azure süreleri 100 nanosaniyelik "tick" olarak verir. */
const TICK = 1e7;

const metinKacisi = (h: string) => (h === "&" ? "&amp;" : h === "<" ? "&lt;" : h === ">" ? "&gt;" : h);
const nitelikKacisi = (m: string) => m.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const desenKacisi = (m: string) => m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Düz metinden SSML kurar. `konumlar[i]`, SSML'in i. karakterinin düz metindeki karşılığıdır
 * (etiket karakterleri için kelimenin başı ya da -1). Azure kelime konumlarını SSML üzerinden verir.
 */
export function ssmlKur(metin: string, sozluk: TelaffuzSozlugu, ses: string): { ssml: string; konumlar: number[] } {
  let ssml = "";
  const konumlar: number[] = [];
  const ekle = (parca: string, duz: number) => {
    ssml += parca;
    for (let i = 0; i < parca.length; i++) konumlar.push(duz);
  };
  const metniEkle = (bas: number, son: number) => {
    for (let i = bas; i < son; i++) ekle(metinKacisi(metin[i]!), i);
  };

  ekle(`<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="tr-TR"><voice name="${nitelikKacisi(ses)}">`, -1);
  const kelimeler = Object.keys(sozluk).sort((a, b) => b.length - a.length);
  let imlec = 0;
  if (kelimeler.length > 0) {
    const desen = new RegExp(`(?<![\\p{L}\\p{N}])(?:${kelimeler.map(desenKacisi).join("|")})(?![\\p{L}\\p{N}])`, "gu");
    for (const eslesme of metin.matchAll(desen)) {
      const bas = eslesme.index;
      metniEkle(imlec, bas);
      const okunus = sozluk[eslesme[0]]!;
      const [ac, kapa] =
        typeof okunus === "string"
          ? [`<sub alias="${nitelikKacisi(okunus)}">`, "</sub>"]
          : [`<phoneme alphabet="ipa" ph="${nitelikKacisi(okunus.ipa)}">`, "</phoneme>"];
      ekle(ac, bas);
      metniEkle(bas, bas + eslesme[0].length);
      ekle(kapa, bas);
      imlec = bas + eslesme[0].length;
    }
  }
  metniEkle(imlec, metin.length);
  ekle("</voice></speak>", -1);
  return { ssml, konumlar };
}

type KelimeOlayi = { text: string; textOffset: number; wordLength: number; audioOffset: number; duration: number };

/**
 * Azure kelime olaylarını düz metindeki konumlara çevirir. SSML konumu bozuk gelirse
 * (ör. telaffuz etiketinden hemen sonra -1) kelime, metinde kaldığı yerden aranır.
 */
export function kelimeZamanlari(olaylar: KelimeOlayi[], metin: string, konumlar: number[]): KelimeZamani[] {
  const sonuc: KelimeZamani[] = [];
  let imlec = 0;
  for (const o of olaylar) {
    let bas = konumlar[o.textOffset] ?? -1;
    let uzunluk = o.wordLength;
    if (bas < imlec) {
      // Bozuk olayda metin önceki kelimelerle birlikte gelir ("\">Temurlar Grup'u"); okunan kelime sondakidir.
      const kelime = o.text.trim().split(/\s+/).at(-1) ?? "";
      bas = kelime ? metin.indexOf(kelime, imlec) : -1;
      uzunluk = kelime.length;
    }
    if (bas < 0) continue;
    sonuc.push({ baslangicKarakter: bas, uzunluk, baslangicSn: o.audioOffset / TICK, bitisSn: (o.audioOffset + o.duration) / TICK });
    imlec = bas + 1;
  }
  return sonuc;
}

export class AzureTtsProvider implements TtsProvider {
  readonly ucretli = true;
  readonly kimlik: string;
  private readonly ses: string;
  private readonly anahtar: string;
  private readonly bolge: string;

  constructor(secenekler: { ses?: string | undefined } = {}) {
    this.ses = secenekler.ses ?? VARSAYILAN_SES;
    this.kimlik = `azure:${this.ses}`;
    const anahtar = process.env.AZURE_SPEECH_KEY;
    const bolge = process.env.AZURE_SPEECH_REGION;
    if (!anahtar || !bolge) {
      throw new SaglayiciHatasi(
        "Azure Speech ayarı eksik. .env dosyasına AZURE_SPEECH_KEY ve AZURE_SPEECH_REGION ekleyin veya API kullanmadan denemek için --mock seçeneğini kullanın.",
      );
    }
    this.anahtar = anahtar;
    this.bolge = bolge;
  }

  async seslendir(istek: SesIstegi): Promise<SesYaniti> {
    const { ssml, konumlar } = ssmlKur(istek.metin, istek.sozluk, this.ses);
    const ayar = sdk.SpeechConfig.fromSubscription(this.anahtar, this.bolge);
    ayar.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Audio48Khz192KBitRateMonoMp3;
    // Ses hoparlöre değil, sonuç nesnesine yazılsın.
    const sentezleyici = new sdk.SpeechSynthesizer(ayar, null as unknown as sdk.AudioConfig);

    const olaylar: KelimeOlayi[] = [];
    sentezleyici.wordBoundary = (_k, e) => {
      if (e.boundaryType === sdk.SpeechSynthesisBoundaryType.Word) olaylar.push(e);
    };

    let sonuc: sdk.SpeechSynthesisResult;
    try {
      sonuc = await new Promise((coz, reddet) => sentezleyici.speakSsmlAsync(ssml, coz, reddet));
    } catch (hata) {
      throw new SaglayiciHatasi(`Azure'a bağlanılamadı. İnternet bağlantısını kontrol edin. Ayrıntı: ${String(hata)}`);
    } finally {
      sentezleyici.close();
    }

    if (sonuc.reason !== sdk.ResultReason.SynthesizingAudioCompleted) {
      const ayrinti = sonuc.errorDetails ?? "";
      if (/401|auth/i.test(ayrinti)) {
        throw new SaglayiciHatasi("Azure Speech anahtarı geçersiz (401). .env dosyasındaki AZURE_SPEECH_KEY ve AZURE_SPEECH_REGION değerlerini kontrol edin.");
      }
      if (/429|quota|throttl/i.test(ayrinti)) {
        throw new SaglayiciHatasi("Azure Speech kotası veya istek sınırı aşıldı (429). Biraz bekleyip tekrar deneyin.");
      }
      throw new SaglayiciHatasi(`Azure ses üretemedi: ${ayrinti || "bilinmeyen hata"}`);
    }

    const karakterSayisi = istek.metin.length;
    return {
      ses: new Uint8Array(sonuc.audioData),
      uzanti: "mp3",
      sureSn: sonuc.audioDuration / TICK,
      kelimeler: kelimeZamanlari(olaylar, istek.metin, konumlar),
      karakterSayisi,
      tahminiMaliyetUsd: (karakterSayisi * FIYAT) / 1_000_000,
    };
  }
}
