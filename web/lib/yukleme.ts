import { yetkiOlustur } from "@cekirdek/veri/yetki.js";
import { auth, depoAl } from "./auth";

export const hataYaniti = (mesaj: string, status: number) => Response.json({ hata: mesaj }, { status });

/**
 * Dosya yükleme route'larının ortak girişi. Sunucu eylemleri yerine route kullanılıyor: eylemlerin gövde sınırı 1 MB.
 * Bu yollar proxy'den geçmiyor (proxy gövdeyi 10 MB'ta kesiyor); oturum burada doğrulanıyor.
 * Hata durumunda gönderilecek yanıtı döner.
 */
export async function yuklemeIstegi(istek: Request, enBuyukMb: number) {
  // Oturum çerezi SameSite=Lax; yine de başka siteden gelen istekleri açıkça reddet.
  const kaynak = istek.headers.get("origin");
  if (kaynak && new URL(kaynak).host !== new URL(istek.url).host) return hataYaniti("İzin verilmeyen istek.", 403);

  const oturum = await auth.api.getSession({ headers: istek.headers });
  if (!oturum) return hataYaniti("Oturumunuz kapanmış. Sayfayı yenileyip tekrar giriş yapın.", 401);

  // Form alanları için küçük bir pay; asıl sınır içerik okunduktan sonra işleme fonksiyonunda.
  if (Number(istek.headers.get("content-length")) > (enBuyukMb + 1) * 1024 * 1024) {
    return hataYaniti(`Dosya ${enBuyukMb} MB'tan büyük. Daha küçük bir sürümünü yükleyin.`, 413);
  }

  let form: FormData;
  try {
    form = await istek.formData();
  } catch {
    return hataYaniti("Yükleme okunamadı. Tekrar deneyin.", 400);
  }
  const dosya = form.get("dosya");
  if (!(dosya instanceof File)) return hataYaniti("Dosya seçilmedi.", 400);
  const yetki = yetkiOlustur(oturum.user);
  return { yetki, depo: depoAl(yetki), form, icerik: Buffer.from(await dosya.arrayBuffer()) };
}
