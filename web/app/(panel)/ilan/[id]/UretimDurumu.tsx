"use client";

import { LoaderCircle, RotateCcw, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { yenidenDene } from "../eylemler";

export type IsOzeti = {
  tur: "senaryo" | "video";
  durum: "bekliyor" | "calisiyor" | "tamamlandi" | "hata";
  asama: string | null;
  ilerleme: number | null;
  hata: { adim: string; mesaj: string; cozum: string } | null;
};

const YENILEME_MS = 3000;
const IS_ADLARI = { senaryo: "Senaryo", video: "Video" } as const;

/** Üretim sürerken sayfayı birkaç saniyede bir yeniler; hata varsa nedenini ve "Yeniden dene"yi gösterir. */
export function UretimDurumu({ ilanId, uretiliyor, hataVar, is }: { ilanId: string; uretiliyor: boolean; hataVar: boolean; is: IsOzeti | null }) {
  const router = useRouter();
  const [bekliyor, gecis] = useTransition();
  const [eylemHatasi, setEylemHatasi] = useState<string | null>(null);

  useEffect(() => {
    if (!uretiliyor) return;
    const sayac = setInterval(() => router.refresh(), YENILEME_MS);
    return () => clearInterval(sayac);
  }, [uretiliyor, router]);

  if (uretiliyor && is) {
    const yuzde = is.ilerleme === null ? null : Math.round(is.ilerleme * 100);
    return (
      <Alert>
        <LoaderCircle className="animate-spin" />
        <AlertTitle>{IS_ADLARI[is.tur]} hazırlanıyor</AlertTitle>
        <AlertDescription className="flex w-full flex-col gap-2">
          <span>{is.durum === "bekliyor" ? "Sırada bekliyor…" : (is.asama ?? "Başladı…")}</span>
          {yuzde !== null ? (
            <span className="h-2 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={yuzde} aria-valuemin={0} aria-valuemax={100}>
              <span className="block h-full bg-primary transition-all" style={{ width: `${yuzde}%` }} />
            </span>
          ) : null}
          <span className="text-xs">Bu sayfadan ayrılabilirsiniz; üretim arka planda sürer.</span>
        </AlertDescription>
      </Alert>
    );
  }

  if (hataVar && is?.hata) {
    return (
      <Alert variant="destructive">
        <TriangleAlert />
        <AlertTitle>
          {IS_ADLARI[is.tur]} üretilemedi · {is.hata.adim}
        </AlertTitle>
        <AlertDescription className="flex w-full flex-col gap-2">
          <span>{is.hata.cozum}</span>
          <details className="text-xs">
            <summary className="cursor-pointer">Ayrıntı</summary>
            <pre className="mt-1 whitespace-pre-wrap font-sans">{is.hata.mesaj}</pre>
          </details>
          <div>
            <Button
              variant="outline"
              size="sm"
              disabled={bekliyor}
              onClick={() => gecis(async () => setEylemHatasi((await yenidenDene(ilanId)).hata))}
            >
              <RotateCcw /> {bekliyor ? "Başlatılıyor…" : "Yeniden dene"}
            </Button>
          </div>
          {eylemHatasi ? <span>{eylemHatasi}</span> : null}
        </AlertDescription>
      </Alert>
    );
  }
  return null;
}
