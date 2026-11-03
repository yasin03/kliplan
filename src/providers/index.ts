import { AnthropicScriptProvider } from "./AnthropicScriptProvider.js";
import { MockScriptProvider } from "./MockScriptProvider.js";
import { SaglayiciHatasi, type ScriptProvider } from "./ScriptProvider.js";

const EFORLAR = ["low", "medium", "high", "xhigh", "max"] as const;

/** `--mock` veya SCRIPT_PROVIDER=mock ise sahte, aksi halde Anthropic sağlayıcısı. */
export function senaryoSaglayicisi(secenekler: { mock?: boolean | undefined } = {}): ScriptProvider {
  const tur = secenekler.mock ? "mock" : (process.env.SCRIPT_PROVIDER ?? "anthropic");
  if (tur === "mock") return new MockScriptProvider();
  if (tur !== "anthropic") throw new SaglayiciHatasi(`Bilinmeyen SCRIPT_PROVIDER: "${tur}". "anthropic" veya "mock" olmalı.`);

  const efor = process.env.SCRIPT_EFFORT;
  if (efor && !(EFORLAR as readonly string[]).includes(efor)) {
    throw new SaglayiciHatasi(`Geçersiz SCRIPT_EFFORT: "${efor}". ${EFORLAR.join(", ")} olmalı.`);
  }
  return new AnthropicScriptProvider({
    model: process.env.SCRIPT_MODEL || undefined,
    efor: (efor || undefined) as (typeof EFORLAR)[number] | undefined,
  });
}
