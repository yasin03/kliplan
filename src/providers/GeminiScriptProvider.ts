import { ApiError, FinishReason, GoogleGenAI, ThinkingLevel } from "@google/genai";
import { z } from "zod";
import { yzSenaryoSemasi } from "../schema/senaryo.js";
import { SaglayiciHatasi, type SaglayiciYaniti, type ScriptProvider, type SenaryoIstegi } from "./ScriptProvider.js";

type Efor = "low" | "medium" | "high" | "xhigh" | "max";

export const VARSAYILAN_GEMINI_MODELI = "gemini-3.8-flash";

/** Gemini'de üç düşünme seviyesi var; üst eforlar HIGH'a eşlenir. */
const DUSUNME: Record<Efor, ThinkingLevel> = {
  low: ThinkingLevel.LOW,
  medium: ThinkingLevel.MEDIUM,
  high: ThinkingLevel.HIGH,
  xhigh: ThinkingLevel.HIGH,
  max: ThinkingLevel.HIGH,
};

const YANIT_SEMASI = z.toJSONSchema(yzSenaryoSemasi);

type GeminiIstemcisi = Pick<GoogleGenAI, "models">;

export class GeminiScriptProvider implements ScriptProvider {
  readonly ucretli = true;
  readonly kimlik: string;
  private readonly istemci: GeminiIstemcisi;
  private readonly model: string;
  private readonly efor: Efor;

  constructor(secenekler: { model?: string | undefined; efor?: Efor | undefined; istemci?: GeminiIstemcisi } = {}) {
    this.model = secenekler.model ?? VARSAYILAN_GEMINI_MODELI;
    this.efor = secenekler.efor ?? "medium";
    this.kimlik = `gemini:${this.model}:${this.efor}`;
    if (secenekler.istemci) {
      this.istemci = secenekler.istemci;
      return;
    }
    const anahtar = process.env.GEMINI_API_KEY;
    if (!anahtar) {
      throw new SaglayiciHatasi(
        "Gemini API anahtarı bulunamadı. .env dosyasına GEMINI_API_KEY ekleyin veya API kullanmadan denemek için --mock seçeneğini kullanın.",
      );
    }
    // Ücretsiz katmanda 503 (yoğunluk) ve 429 sık görülür; SDK artan aralıklarla yeniden dener.
    this.istemci = new GoogleGenAI({ apiKey: anahtar, httpOptions: { retryOptions: { attempts: 5, initialDelay: 2 } } });
  }

  async senaryoUret(istek: SenaryoIstegi): Promise<SaglayiciYaniti> {
    let yanit;
    try {
      yanit = await this.istemci.models.generateContent({
        model: this.model,
        contents: [{ role: "user", parts: [{ text: istek.kullanici }] }],
        config: {
          systemInstruction: istek.sistem,
          maxOutputTokens: 16000,
          responseMimeType: "application/json",
          responseJsonSchema: YANIT_SEMASI,
          thinkingConfig: { thinkingLevel: DUSUNME[this.efor] },
        },
      });
    } catch (hata) {
      throw new SaglayiciHatasi(apiHatasiMesaji(hata));
    }

    if (yanit.promptFeedback?.blockReason) {
      throw new SaglayiciHatasi(`Model isteği reddetti (${yanit.promptFeedback.blockReason}). İlan metnini kontrol edin.`);
    }
    const bitis = yanit.candidates?.[0]?.finishReason;
    if (bitis === FinishReason.MAX_TOKENS) {
      throw new SaglayiciHatasi("Model yanıtı token sınırında kesildi.");
    }
    if (bitis && bitis !== FinishReason.STOP) {
      throw new SaglayiciHatasi(`Model yanıtı tamamlanmadı (${bitis}). İlan metnini kontrol edin.`);
    }

    // Ayrıştırma başarısızsa ham metin de doğrulamaya gider; hata mesajı modele geri bildirilir.
    const metin = yanit.text ?? "";
    let cikti: unknown;
    try {
      cikti = JSON.parse(metin);
    } catch {
      cikti = metin;
    }

    const kullanim = yanit.usageMetadata;
    return {
      cikti,
      kullanim: {
        girdiToken: kullanim?.promptTokenCount ?? 0,
        ciktiToken: (kullanim?.candidatesTokenCount ?? 0) + (kullanim?.thoughtsTokenCount ?? 0),
        // Ücretsiz katmanda kullanılıyor; faturalandırma açılırsa fiyat tablosu eklenmeli.
        tahminiMaliyetUsd: 0,
      },
    };
  }
}

function apiHatasiMesaji(hata: unknown): string {
  if (hata instanceof ApiError) {
    if (hata.status === 400) return `Gemini isteği reddetti (400): ${hata.message}`;
    if (hata.status === 401 || hata.status === 403)
      return `Gemini API anahtarı geçersiz veya yetkisiz (${hata.status}). .env dosyasındaki GEMINI_API_KEY değerini kontrol edin.`;
    if (hata.status === 404) return "Model bulunamadı (404). SCRIPT_MODEL ayarını kontrol edin.";
    if (hata.status === 429)
      return "Gemini ücretsiz katman sınırı aşıldı (429). Biraz bekleyip tekrar deneyin; günlük sınır dolduysa ertesi gün sıfırlanır.";
    return `Gemini API hatası (${hata.status}): ${hata.message}`;
  }
  return (
    "Gemini isteği gönderilemedi. İnternet bağlantısını kontrol edin; " +
    `API kullanmadan denemek için --mock kullanın. Ayrıntı: ${hata instanceof Error ? hata.message : String(hata)}`
  );
}
