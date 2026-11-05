import { EN_BUYUK_DOSYA_MB, fotografiIsle } from "@cekirdek/veri/fotografIsleme.js";
import { fotografTuruMu } from "@cekirdek/veri/ilanFormu.js";
import { BulunamadiHatasi, yetkiOlustur } from "@cekirdek/veri/yetki.js";
import { auth, depoAl } from "@/lib/auth";
import { kullaniciMesaji } from "@/lib/hatalar";

const hata = (mesaj: string, status: number) => Response.json({ hata: mesaj }, { status });

/**
 * Tek fotoğraf yükler (`dosya`, `tur`). Sunucu eylemleri yerine route kullanılıyor: eylemlerin gövde sınırı 1 MB.
 * Bu yol proxy'den geçmiyor (proxy gövdeyi 10 MB'ta kesiyor); oturum burada doğrulanıyor.
 */
export async function POST(istek: Request, { params }: RouteContext<"/api/ilan/[id]/fotograf">) {
  // Oturum çerezi SameSite=Lax; yine de başka siteden gelen istekleri açıkça reddet.
  const kaynak = istek.headers.get("origin");
  if (kaynak && new URL(kaynak).host !== new URL(istek.url).host) return hata("İzin verilmeyen istek.", 403);

  const oturum = await auth.api.getSession({ headers: istek.headers });
  if (!oturum) return hata("Oturumunuz kapanmış. Sayfayı yenileyip tekrar giriş yapın.", 401);

  // Form alanları için küçük bir pay; asıl sınır içerik okunduktan sonra fotografiIsle'de.
  if (Number(istek.headers.get("content-length")) > (EN_BUYUK_DOSYA_MB + 1) * 1024 * 1024) {
    return hata(`Dosya ${EN_BUYUK_DOSYA_MB} MB'tan büyük. Daha küçük bir sürümünü yükleyin.`, 413);
  }

  let form: FormData;
  try {
    form = await istek.formData();
  } catch {
    return hata("Yükleme okunamadı. Tekrar deneyin.", 400);
  }
  const dosya = form.get("dosya");
  const tur = String(form.get("tur") ?? "diger");
  if (!(dosya instanceof File)) return hata("Dosya seçilmedi.", 400);
  if (!fotografTuruMu(tur)) return hata("Geçersiz fotoğraf türü.", 400);

  try {
    const depo = depoAl(yetkiOlustur(oturum.user));
    const islenmis = await fotografiIsle(Buffer.from(await dosya.arrayBuffer()));
    const kayit = await depo.fotografEkle((await params).id, { ...islenmis, tur });
    return Response.json({ id: kayit.id }, { status: 201 });
  } catch (e) {
    const mesaj = kullaniciMesaji(e);
    if (!mesaj) throw e;
    return hata(mesaj, e instanceof BulunamadiHatasi ? 404 : 400);
  }
}
