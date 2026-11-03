import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { yzSenaryoSemasi } from "../schema/senaryo.js";
import { SaglayiciHatasi, type SaglayiciYaniti, type ScriptProvider, type SenaryoIstegi } from "./ScriptProvider.js";

type Efor = "low" | "medium" | "high" | "xhigh" | "max";

/** ABD doları / 1 milyon token, Anthropic fiyat listesi (Ekim 2026). Yalnızca maliyet tahmini içindir. */
const FIYATLAR: Record<string, { girdi: number; cikti: number }> = {
  "claude-opus-5-5": { girdi: 4, cikti: 20 },
  "claude-sonnet-5-5": { girdi: 2, cikti: 10 },
  "claude-haiku-5-5": { girdi: 0.1, cikti: 0.5 },
};

export const VARSAYILAN_MODEL = "claude-opus-5-5";

export class AnthropicScriptProvider implements ScriptProvider {
  readonly ucretli = true;
  readonly kimlik: string;
  private readonly istemci: Anthropic;
  private readonly model: string;
  private readonly efor: Efor;

  constructor(secenekler: { model?: string | undefined; efor?: Efor | undefined; istemci?: Anthropic } = {}) {
    this.model = secenekler.model ?? VARSAYILAN_MODEL;
    this.efor = secenekler.efor ?? "medium";
    this.kimlik = `anthropic:${this.model}:${this.efor}`;
    try {
      this.istemci = secenekler.istemci ?? new Anthropic();
    } catch {
      throw new SaglayiciHatasi(
        "Anthropic API anahtarı bulunamadı. .env dosyasına ANTHROPIC_API_KEY ekleyin veya API kullanmadan denemek için --mock seçeneğini kullanın.",
      );
    }
  }

  async senaryoUret(istek: SenaryoIstegi): Promise<SaglayiciYaniti> {
    // Haiku için sunucu tarafı yedek model desteklenmiyor.
    const yedek = this.model.includes("haiku")
      ? {}
      : { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const };

    let yanit;
    try {
      yanit = await this.istemci.beta.messages.parse({
        model: this.model,
        max_tokens: 16000,
        ...yedek,
        output_config: { effort: this.efor, format: betaZodOutputFormat(yzSenaryoSemasi) },
        system: istek.sistem,
        messages: [{ role: "user", content: istek.kullanici }],
      });
    } catch (hata) {
      throw new SaglayiciHatasi(apiHatasiMesaji(hata));
    }

    if (yanit.stop_reason === "refusal") {
      throw new SaglayiciHatasi(`Model isteği reddetti (${yanit.stop_details?.category ?? "kategori yok"}). İlan metnini kontrol edin.`);
    }
    if (yanit.stop_reason === "max_tokens") {
      throw new SaglayiciHatasi("Model yanıtı token sınırında kesildi.");
    }

    // Ayrıştırma başarısızsa ham metin de doğrulamaya gider; hata mesajı modele geri bildirilir.
    let cikti: unknown = yanit.parsed_output;
    if (cikti == null) {
      const metin = yanit.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
      try {
        cikti = JSON.parse(metin);
      } catch {
        cikti = metin;
      }
    }

    const fiyat = FIYATLAR[this.model];
    const girdiToken =
      yanit.usage.input_tokens + (yanit.usage.cache_creation_input_tokens ?? 0) + (yanit.usage.cache_read_input_tokens ?? 0);
    const ciktiToken = yanit.usage.output_tokens;
    return {
      cikti,
      kullanim: {
        girdiToken,
        ciktiToken,
        tahminiMaliyetUsd: fiyat ? (girdiToken * fiyat.girdi + ciktiToken * fiyat.cikti) / 1_000_000 : Number.NaN,
      },
    };
  }
}

function apiHatasiMesaji(hata: unknown): string {
  if (hata instanceof Anthropic.AuthenticationError) return "Anthropic API anahtarı geçersiz (401). .env dosyasındaki ANTHROPIC_API_KEY değerini kontrol edin.";
  if (hata instanceof Anthropic.PermissionDeniedError) return "Bu API anahtarının modele erişim izni yok (403).";
  if (hata instanceof Anthropic.NotFoundError) return "Model bulunamadı (404). SCRIPT_MODEL ayarını kontrol edin.";
  if (hata instanceof Anthropic.RateLimitError) return "Anthropic istek sınırı aşıldı (429). Biraz bekleyip tekrar deneyin.";
  if (hata instanceof Anthropic.BadRequestError) return `Anthropic isteği reddetti (400): ${hata.message}`;
  if (hata instanceof Anthropic.APIConnectionError) return "Anthropic API'ye bağlanılamadı. İnternet bağlantısını kontrol edin.";
  if (hata instanceof Anthropic.APIError) return `Anthropic API hatası (${hata.status}): ${hata.message}`;
  // Kimlik bilgisi bulunamaması gibi istek öncesi hatalar SDK'dan düz Error olarak gelir.
  return (
    "Anthropic isteği gönderilemedi. .env dosyasında ANTHROPIC_API_KEY tanımlı mı kontrol edin; " +
    `API kullanmadan denemek için --mock kullanın. Ayrıntı: ${hata instanceof Error ? hata.message : String(hata)}`
  );
}
