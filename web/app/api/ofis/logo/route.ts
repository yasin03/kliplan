import { LOGO_EN_BUYUK_MB, logoyuIsle } from "@cekirdek/veri/gorunumIsleme.js";
import { BulunamadiHatasi } from "@cekirdek/veri/yetki.js";
import { kullaniciMesaji } from "@/lib/hatalar";
import { hataYaniti, yuklemeIstegi } from "@/lib/yukleme";

/** Şirkete yeni logo ekler (`dosya`; admin için `ofisId`). Uyarılar (ör. açık temada görünmeyecek beyaz logo) yanıtta döner. */
export async function POST(istek: Request) {
  const yukleme = await yuklemeIstegi(istek, LOGO_EN_BUYUK_MB);
  if (yukleme instanceof Response) return yukleme;
  const ofisId = String(yukleme.form.get("ofisId") ?? "") || undefined;

  try {
    const logo = await logoyuIsle(yukleme.icerik);
    const kayit = await yukleme.depo.logoEkle(logo, ofisId);
    return Response.json({ id: kayit.id, uyarilar: logo.uyarilar }, { status: 201 });
  } catch (e) {
    const mesaj = kullaniciMesaji(e);
    if (!mesaj) throw e;
    return hataYaniti(mesaj, e instanceof BulunamadiHatasi ? 404 : 400);
  }
}
