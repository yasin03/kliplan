import type { IlanBilgileri } from "@cekirdek/veri/ilanFormu.js";
import { veriyiFormaCevir } from "@cekirdek/veri/ilanFormu.js";
import { AdimCubugu } from "@/components/AdimCubugu";
import { bulunamazsa404 } from "@/lib/hatalar";
import { girisGerekli } from "@/lib/oturum";
import { IlanFormu } from "../../IlanFormu";

export default async function IlanBilgileriSayfasi({ params }: PageProps<"/ilan/[id]/bilgiler">) {
  const { id } = await params;
  const { depo } = await girisGerekli();
  const [ilan, ofis] = await bulunamazsa404(Promise.all([depo.ilan(id), depo.ilanOfisi(id)]));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">İlan bilgileri</h1>
      <AdimCubugu ilanId={id} etkin="bilgiler" />
      {ilan.durum === "kontrol_bekliyor" || ilan.durum === "onaylandi" ? (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Bilgileri değiştirirseniz senaryo silinir ve videonun yeniden üretilmesi gerekir.
        </p>
      ) : null}
      <IlanFormu ilanId={id} baslangic={veriyiFormaCevir(ilan.veri as Partial<IlanBilgileri>)} ofisAdi={ofis.ad} />
    </div>
  );
}
