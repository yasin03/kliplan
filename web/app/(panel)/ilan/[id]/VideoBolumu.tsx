import { CircleCheck, Download, FileText, FlaskConical } from "lucide-react";
import { kontrolMaddeleri } from "@cekirdek/pipeline/kontrolListesi.js";
import { iletisimBilgisi } from "@cekirdek/pipeline/videoProps.js";
import type { Depo } from "@cekirdek/veri/depo.js";
import type { Ilan } from "@cekirdek/schema/ilan.js";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { boyutMetni, tarihMetni } from "@/lib/ilan";
import { OnayFormu } from "./OnayFormu";

type Video = Awaited<ReturnType<Depo["videolar"]>>[number];

type Props = {
  depo: Depo;
  ilanId: string;
  durum: string;
  videolar: Video[];
  /** Güncel ilan bilgileri; kontrol listesi bunlardan kurulur. Eksikse onay gösterilmez. */
  ilan: Ilan | null;
};

/** Son sürümün önizlemesi, onayı ve indirme bağlantıları; altta önceki sürümler. */
export async function VideoBolumu({ depo, ilanId, durum, videolar, ilan }: Props) {
  const [son, ...oncekiler] = videolar;
  if (!son) return null;

  const [izle, kapak, rapor] = await Promise.all([
    depo.dosyaBaglantisi(son.videoAnahtari),
    depo.dosyaBaglantisi(son.kapakAnahtari),
    depo.videoIndirmeBaglantisi(son.id, "rapor"),
  ]);
  const onayli = Boolean(son.onayZamani);
  const indirmeler = onayli ? await Promise.all([depo.videoIndirmeBaglantisi(son.id, "video"), depo.videoIndirmeBaglantisi(son.id, "kapak")]) : null;
  // Bilgi değiştiyse veya yeni üretim sürüyorsa bu sürüm artık onaylanamaz (durum taslak/üretiliyor olur).
  const onaylanabilir = !onayli && !son.test && durum === "kontrol_bekliyor" && ilan;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Video · sürüm {son.surum}</CardTitle>
        <CardDescription>
          {son.sureSn.toFixed(1)} sn · {boyutMetni(son.boyutBayt)} · {tarihMetni(son.olusturma)}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-[minmax(0,320px)_1fr]">
        <video
          controls
          playsInline
          preload="metadata"
          poster={kapak}
          src={izle}
          className="aspect-9/16 w-full max-w-[320px] rounded-lg bg-black"
          aria-label={`Video sürüm ${son.surum}`}
        />
        <div className="flex flex-col gap-4">
          {son.test ? (
            <Alert>
              <FlaskConical />
              <AlertTitle>Test üretimi</AlertTitle>
              <AlertDescription>Sahte metin ve sessiz sesle üretildi; müşteriye gönderilmez ve onaylanamaz.</AlertDescription>
            </Alert>
          ) : null}

          {onayli ? (
            <Alert>
              <CircleCheck className="text-green-600" />
              <AlertTitle>Onaylandı</AlertTitle>
              <AlertDescription>
                {tarihMetni(son.onayZamani!)} tarihinde kontrol listesi tamamlanarak onaylandı.
                {durum !== "onaylandi" ? " İlan bilgileri veya senaryo onaydan sonra değişti; güncel hali için videoyu yeniden üretin." : ""}
              </AlertDescription>
            </Alert>
          ) : onaylanabilir ? (
            <div className="flex flex-col gap-2">
              <p className="font-medium">Göndermeden önce kontrol edin</p>
              <p className="text-sm text-muted-foreground">Videoyu baştan sona izleyin. Onaydan sonra video indirilebilir.</p>
              <OnayFormu ilanId={ilanId} videoId={son.id} maddeler={kontrolMaddeleri(ilan, iletisimBilgisi(ilan)).map(({ kod, metin }) => ({ kod, metin }))} />
            </div>
          ) : !son.test ? (
            <p className="text-sm text-muted-foreground">Bu sürüm ilanın güncel bilgileriyle üretilmedi. Onaylamak için videoyu yeniden üretin.</p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {indirmeler ? (
              <>
                <a href={indirmeler[0]} className={buttonVariants({ size: "lg" })}>
                  <Download /> Videoyu indir
                </a>
                <a href={indirmeler[1]} className={buttonVariants({ variant: "outline", size: "lg" })}>
                  <Download /> Kapağı indir
                </a>
              </>
            ) : null}
            <a href={rapor} className={buttonVariants({ variant: "outline", size: "lg" })}>
              <FileText /> Kontrol raporu
            </a>
          </div>
        </div>
      </CardContent>

      {oncekiler.length ? (
        <CardContent>
          <details className="text-sm">
            <summary className="cursor-pointer font-medium">Önceki sürümler ({oncekiler.length})</summary>
            <ul className="mt-2 flex flex-col gap-1 text-muted-foreground">
              {oncekiler.map((v) => (
                <li key={v.id}>
                  Sürüm {v.surum} · {tarihMetni(v.olusturma)} · {v.sureSn.toFixed(1)} sn
                  {v.onayZamani ? ` · onaylandı (${tarihMetni(v.onayZamani)})` : v.test ? " · test" : ""}
                </li>
              ))}
            </ul>
          </details>
        </CardContent>
      ) : null}
    </Card>
  );
}
