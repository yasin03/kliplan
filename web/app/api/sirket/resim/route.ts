import { EN_BUYUK_DOSYA_MB, fotografiIsle } from "@cekirdek/veri/fotografIsleme.js";
import { BulunamadiHatasi } from "@cekirdek/veri/yetki.js";
import { kullaniciMesaji } from "@/lib/hatalar";
import { hataYaniti, yuklemeIstegi } from "@/lib/yukleme";

/** Şirket resmi yükler (`dosya`; admin için `ofisId`). İlan fotoğraflarıyla aynı işlem: EXIF silinir, küçültülür, JPEG. */
export async function POST(istek: Request) {
  const yukleme = await yuklemeIstegi(istek, EN_BUYUK_DOSYA_MB);
  if (yukleme instanceof Response) return yukleme;
  const ofisId = String(yukleme.form.get("ofisId") ?? "") || undefined;

  try {
    const resim = await fotografiIsle(yukleme.icerik);
    const kayit = await yukleme.depo.resimEkle(resim, ofisId);
    return Response.json({ id: kayit.id }, { status: 201 });
  } catch (e) {
    const mesaj = kullaniciMesaji(e);
    if (!mesaj) throw e;
    return hataYaniti(mesaj, e instanceof BulunamadiHatasi ? 404 : 400);
  }
}
