import { MUZIK_EN_BUYUK_MB, muzigiIsle } from "@cekirdek/veri/gorunumIsleme.js";
import { BulunamadiHatasi } from "@cekirdek/veri/yetki.js";
import { kullaniciMesaji } from "@/lib/hatalar";
import { hataYaniti, yuklemeIstegi } from "@/lib/yukleme";

/**
 * Müzik yükler: `dosya`, `ad`, `lisans`. Admin `kutuphane=on` ile hazır kütüphaneye ekler;
 * ofis yüklemesinde `beyan=on` (ticari kullanım beyanı) zorunlu. Admin bir ofis adına yüklerken `ofisId` verir.
 */
export async function POST(istek: Request) {
  const yukleme = await yuklemeIstegi(istek, MUZIK_EN_BUYUK_MB);
  if (yukleme instanceof Response) return yukleme;
  const { form } = yukleme;
  const alan = (ad: string) => String(form.get(ad) ?? "");

  try {
    const dosya = await muzigiIsle(yukleme.icerik);
    const kayit = await yukleme.depo.muzikEkle(
      { ad: alan("ad"), lisans: alan("lisans"), kutuphane: alan("kutuphane") === "on", beyanOnayi: alan("beyan") === "on", dosya },
      alan("ofisId") || undefined,
    );
    return Response.json({ id: kayit.id }, { status: 201 });
  } catch (e) {
    const mesaj = kullaniciMesaji(e);
    if (!mesaj) throw e;
    return hataYaniti(mesaj, e instanceof BulunamadiHatasi ? 404 : 400);
  }
}
