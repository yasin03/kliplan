import type { SenaryoSonucu } from "@cekirdek/pipeline/senaryoUretimi.js";
import { AdimCubugu } from "@/components/AdimCubugu";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { bulunamazsa404 } from "@/lib/hatalar";
import { isOzeti } from "@/lib/ilan";
import { ilanBaglami } from "@/lib/ilanBaglami";
import { girisGerekli } from "@/lib/oturum";
import { UretimButonu } from "../UretimButonu";
import { UretimDurumu } from "../UretimDurumu";
import { SenaryoEditoru } from "./SenaryoEditoru";

export default async function SenaryoSayfasi({ params }: PageProps<"/ilan/[id]/senaryo">) {
  const { id } = await params;
  const { depo } = await girisGerekli();
  const [{ ilan, fotograflar, json }, sonIs] = await bulunamazsa404(Promise.all([ilanBaglami(depo, id), depo.sonIs(id)]));
  const kayitli = ilan.senaryo as SenaryoSonucu | null;
  const uretiliyor = ilan.durum === "uretiliyor";
  const fotoKartlari = await Promise.all(fotograflar.map(async (f) => ({ dosyaAdi: f.dosyaAdi, tur: f.tur, adres: await depo.dosyaBaglantisi(f.anahtar) })));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Senaryo</h1>
      <AdimCubugu ilanId={id} etkin="senaryo" />
      <UretimDurumu ilanId={id} uretiliyor={uretiliyor} hataVar={ilan.durum === "hata"} is={isOzeti(sonIs)} />

      {kayitli && json.basarili ? (
        <>
          <p className="text-sm text-muted-foreground">
            Metinleri kontrol edin, gerekirse düzeltin. Kaydettiğiniz senaryo yapay zekanın uyduğu kurallardan geçer.
            {kayitli.duzenlendi ? " Bu senaryo elle düzenlendi; kontrol raporunda belirtilir." : ""}
          </p>
          <SenaryoEditoru
            key={JSON.stringify(kayitli.senaryo)}
            ilanId={id}
            ilan={json.ilan}
            senaryo={kayitli.senaryo}
            fotograflar={fotoKartlari}
            kilitli={uretiliyor}
          />
        </>
      ) : !uretiliyor ? (
        <Card>
          <CardHeader>
            <CardTitle>Senaryo henüz yok</CardTitle>
            <CardDescription>
              {json.basarili
                ? "Yapay zeka, ilan bilgileri ve fotoğraflardan sahne metinlerini yazar. Video üretilmeden önce metinleri görüp düzenleyebilirsiniz."
                : "Senaryo üretmeden önce şunları tamamlayın:"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {!json.basarili ? (
              <ul className="list-disc pl-5 text-sm text-destructive">
                {json.hatalar.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            ) : null}
            <div>
              <UretimButonu ilanId={id} tur="senaryo" etiket="Senaryoyu üret" disabled={!json.basarili} />
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
