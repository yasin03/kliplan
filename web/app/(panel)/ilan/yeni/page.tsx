import { veriyiFormaCevir } from "@cekirdek/veri/ilanFormu.js";
import { AdimCubugu } from "@/components/AdimCubugu";
import { gorunumSecenekleri } from "@/lib/gorunumSecenekleri";
import { girisGerekli } from "@/lib/oturum";
import { IlanFormu } from "../IlanFormu";

export default async function YeniIlanSayfasi() {
  const { depo, ofis, yetki } = await girisGerekli();
  // Ofis ayarlarında telefon ve yetki belgesi varsa form onlarla başlar.
  // Önce cep telefonu: ilanda aranacak numara çoğunlukla odur.
  const telefon = ofis?.cepTelefonu ?? ofis?.telefon;
  const baslangic = veriyiFormaCevir({
    ...(telefon ? { telefon: { deger: telefon, onayli: false } } : {}),
    ...(ofis?.yetkiBelgeNo ? { yetkiBelgeNo: { deger: ofis.yetkiBelgeNo, onayli: false } } : {}),
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Yeni ilan</h1>
      <AdimCubugu ilanId={null} etkin="bilgiler" />
      <IlanFormu
        ilanId={null}
        baslangic={baslangic}
        ofisAdi={ofis?.ad ?? null}
        {...(yetki.admin ? { ofisler: await depo.ofisler() } : {})}
        {...(ofis && !yetki.admin ? { gorunum: await gorunumSecenekleri(depo, ofis) } : {})}
      />
    </div>
  );
}
