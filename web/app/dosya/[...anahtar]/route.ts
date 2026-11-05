import path from "node:path";
import { DepolamaHatasi, anahtariDogrula, imzaGecerliMi } from "@cekirdek/depolama/Depolama.js";
import { depolama } from "@/lib/auth";

const TURLER: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".mp3": "audio/mpeg",
  ".json": "application/json",
  ".md": "text/markdown; charset=utf-8",
};

/**
 * Yalnızca yerel depolamada kullanılır: imzalı bağlantının dosyasını sunar. Yetki, bağlantıyı üreten
 * veri katmanında kontrol edilir; burada imza ve süre doğrulanır. Sunucuda R2 kendi bağlantısını verir.
 */
export async function GET(istek: Request, { params }: { params: Promise<{ anahtar: string[] }> }) {
  if (depolama.kimlik !== "yerel") return new Response(null, { status: 404 });
  const anahtar = (await params).anahtar.join("/");
  const adres = new URL(istek.url);
  const son = Number(adres.searchParams.get("son"));
  const imza = adres.searchParams.get("imza") ?? "";

  try {
    anahtariDogrula(anahtar);
  } catch {
    return new Response("Geçersiz bağlantı.", { status: 400 });
  }
  if (!imzaGecerliMi(anahtar, son, imza, process.env.BETTER_AUTH_SECRET ?? "")) {
    return new Response("Bağlantının süresi dolmuş veya geçersiz. Sayfayı yenileyin.", { status: 403 });
  }

  try {
    const icerik = await depolama.oku(anahtar);
    return new Response(new Uint8Array(icerik), {
      headers: {
        "Content-Type": TURLER[path.extname(anahtar).toLowerCase()] ?? "application/octet-stream",
        "Cache-Control": "private, max-age=600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (hata) {
    if (hata instanceof DepolamaHatasi) return new Response("Dosya bulunamadı.", { status: 404 });
    throw hata;
  }
}
