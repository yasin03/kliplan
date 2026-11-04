import { AnthropicScriptProvider } from "./AnthropicScriptProvider.js";
import { AzureTtsProvider } from "./AzureTtsProvider.js";
import { GeminiScriptProvider } from "./GeminiScriptProvider.js";
import { MockScriptProvider } from "./MockScriptProvider.js";
import { MockTtsProvider } from "./MockTtsProvider.js";
import { SaglayiciHatasi, type ScriptProvider } from "./ScriptProvider.js";
import type { TtsProvider } from "./TtsProvider.js";

const EFORLAR = ["low", "medium", "high", "xhigh", "max"] as const;
const SAGLAYICILAR = ["gemini", "anthropic", "mock"] as const;

/** `--mock` veya SCRIPT_PROVIDER=mock ise sahte, aksi halde SCRIPT_PROVIDER'daki sağlayıcı (varsayılan Gemini). */
export function senaryoSaglayicisi(secenekler: { mock?: boolean | undefined } = {}): ScriptProvider {
  const tur = secenekler.mock ? "mock" : (process.env.SCRIPT_PROVIDER ?? "gemini");
  if (tur === "mock") return new MockScriptProvider();
  if (!(SAGLAYICILAR as readonly string[]).includes(tur)) {
    throw new SaglayiciHatasi(`Bilinmeyen SCRIPT_PROVIDER: "${tur}". ${SAGLAYICILAR.join(", ")} olmalı.`);
  }

  const efor = process.env.SCRIPT_EFFORT;
  if (efor && !(EFORLAR as readonly string[]).includes(efor)) {
    throw new SaglayiciHatasi(`Geçersiz SCRIPT_EFFORT: "${efor}". ${EFORLAR.join(", ")} olmalı.`);
  }
  const ayarlar = {
    model: process.env.SCRIPT_MODEL || undefined,
    efor: (efor || undefined) as (typeof EFORLAR)[number] | undefined,
  };
  return tur === "anthropic" ? new AnthropicScriptProvider(ayarlar) : new GeminiScriptProvider(ayarlar);
}

/** `--mock` veya TTS_PROVIDER=mock ise sahte, aksi halde Azure. ElevenLabs henüz bağlanmadı. */
export function sesSaglayicisi(secenekler: { mock?: boolean | undefined } = {}): TtsProvider {
  const tur = secenekler.mock ? "mock" : (process.env.TTS_PROVIDER ?? "azure");
  if (tur === "mock") return new MockTtsProvider();
  if (tur !== "azure") {
    throw new SaglayiciHatasi(`Desteklenmeyen TTS_PROVIDER: "${tur}". Şu an "azure" veya "mock" kullanılabilir.`);
  }
  return new AzureTtsProvider({ ses: process.env.TTS_VOICE || undefined });
}
