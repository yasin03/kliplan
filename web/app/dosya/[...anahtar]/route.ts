import path from "node:path";
import { aralikCoz, DepolamaHatasi, GECERLI_INDIRME_ADI, anahtariDogrula, imzaGecerliMi } from "@cekirdek/depolama/Depolama.js";
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
  const indir = adres.searchParams.get("indir") ?? "";

  try {
    anahtariDogrula(anahtar);
  } catch {
    return new Response("Geçersiz bağlantı.", { status: 400 });
  }
  if ((indir && !GECERLI_INDIRME_ADI.test(indir)) || !imzaGecerliMi(anahtar, son, imza, process.env.BETTER_AUTH_SECRET ?? "", Date.now(), indir)) {
    return new Response("Bağlantının süresi dolmuş veya geçersiz. Sayfayı yenileyin.", { status: 403 });
  }

  let icerik: Buffer;
  try {
    icerik = await depolama.oku(anahtar);
  } catch (hata) {
    if (hata instanceof DepolamaHatasi) return new Response("Dosya bulunamadı.", { status: 404 });
    throw hata;
  }

  const basliklar: Record<string, string> = {
    "Content-Type": TURLER[path.extname(anahtar).toLowerCase()] ?? "application/octet-stream",
    "Cache-Control": "private, max-age=600",
    "X-Content-Type-Options": "nosniff",
    "Accept-Ranges": "bytes",
    ...(indir ? { "Content-Disposition": `attachment; filename="${indir}"` } : {}),
  };
  const aralik = aralikCoz(istek.headers.get("range"), icerik.length);
  if (aralik === "gecersiz") {
    return new Response(null, { status: 416, headers: { ...basliklar, "Content-Range": `bytes */${icerik.length}` } });
  }
  if (aralik) {
    return new Response(new Uint8Array(icerik.subarray(aralik.bas, aralik.son + 1)), {
      status: 206,
      headers: { ...basliklar, "Content-Range": `bytes ${aralik.bas}-${aralik.son}/${icerik.length}`, "Content-Length": String(aralik.son - aralik.bas + 1) },
    });
  }
  return new Response(new Uint8Array(icerik), { headers: { ...basliklar, "Content-Length": String(icerik.length) } });
}
