import { EN_BUYUK_DOSYA_MB, fotografiIsle } from "@cekirdek/veri/fotografIsleme.js";
import { fotografTuruMu } from "@cekirdek/veri/ilanFormu.js";
import { BulunamadiHatasi } from "@cekirdek/veri/yetki.js";
import { kullaniciMesaji } from "@/lib/hatalar";
import { hataYaniti, yuklemeIstegi } from "@/lib/yukleme";

/** Tek fotoğraf yükler (`dosya`, `tur`). */
export async function POST(istek: Request, { params }: RouteContext<"/api/ilan/[id]/fotograf">) {
  const yukleme = await yuklemeIstegi(istek, EN_BUYUK_DOSYA_MB);
  if (yukleme instanceof Response) return yukleme;
  const tur = String(yukleme.form.get("tur") ?? "diger");
  if (!fotografTuruMu(tur)) return hataYaniti("Geçersiz fotoğraf türü.", 400);

  try {
    const islenmis = await fotografiIsle(yukleme.icerik);
    const kayit = await yukleme.depo.fotografEkle((await params).id, { ...islenmis, tur });
    return Response.json({ id: kayit.id }, { status: 201 });
  } catch (e) {
    const mesaj = kullaniciMesaji(e);
    if (!mesaj) throw e;
    return hataYaniti(mesaj, e instanceof BulunamadiHatasi ? 404 : 400);
  }
}
