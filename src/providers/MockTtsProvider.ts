import type { KelimeZamani, SesIstegi, SesYaniti, TtsProvider } from "./TtsProvider.js";

/** Sahte sesin konuşma hızı: Türkçe dış ses ortalamasına yakın, kelime başına 0,4 saniye. */
const KELIME_SURESI = 0.4;
const ORNEKLEME = 16_000;

/** Verilen süre kadar sessiz, 16 bit mono WAV dosyası. */
export function sessizWav(sureSn: number): Uint8Array {
  const ornekSayisi = Math.round(sureSn * ORNEKLEME);
  const veriBoyutu = ornekSayisi * 2;
  const tampon = new ArrayBuffer(44 + veriBoyutu);
  const v = new DataView(tampon);
  const yaz = (konum: number, metin: string) => [...metin].forEach((h, i) => v.setUint8(konum + i, h.charCodeAt(0)));
  yaz(0, "RIFF");
  v.setUint32(4, 36 + veriBoyutu, true);
  yaz(8, "WAVEfmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, ORNEKLEME, true);
  v.setUint32(28, ORNEKLEME * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  yaz(36, "data");
  v.setUint32(40, veriBoyutu, true);
  return new Uint8Array(tampon);
}

/** API kullanmadan, kelime sayısına göre sessiz ses ve eşit aralıklı kelime zamanları üretir. */
export class MockTtsProvider implements TtsProvider {
  readonly kimlik = "mock-tts";
  readonly ucretli = false;
  readonly istekler: SesIstegi[] = [];

  seslendir(istek: SesIstegi): Promise<SesYaniti> {
    this.istekler.push(istek);
    const kelimeler: KelimeZamani[] = [...istek.metin.matchAll(/\S+/g)].map((e, i) => ({
      baslangicKarakter: e.index,
      uzunluk: e[0].length,
      baslangicSn: i * KELIME_SURESI,
      bitisSn: (i + 1) * KELIME_SURESI - 0.05,
    }));
    const sureSn = kelimeler.length * KELIME_SURESI;
    return Promise.resolve({
      ses: sessizWav(sureSn),
      uzanti: "wav",
      sureSn,
      kelimeler,
      karakterSayisi: istek.metin.length,
      tahminiMaliyetUsd: 0,
    });
  }
}
