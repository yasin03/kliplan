import { Label } from "@/components/ui/label";

type Props = {
  /** Girdinin kimliği; etiket buna bağlanır. Verilmezse etiket bir grup başlığıdır. */
  ad?: string | undefined;
  etiket: string;
  aciklama?: string | undefined;
  hata?: string | undefined;
  /** Sağdaki ek denetim, ör. "videoda göster" anahtarı. */
  ek?: React.ReactNode;
  children: React.ReactNode;
};

/**
 * Yatay form satırı: solda etiket, ortada girdi, sağda isteğe bağlı anahtar. Açıklama ve hata girdinin altında.
 * Dar ekranda etiket üstte kalır.
 */
export function FormSatiri({ ad, etiket, aciklama, hata, ek, children }: Props) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-1.5 sm:grid-cols-[minmax(6rem,11rem)_minmax(0,1fr)_auto]">
      <div className="col-start-1 row-start-1 flex min-h-8 items-center">
        {ad ? <Label htmlFor={ad}>{etiket}</Label> : <span className="text-sm leading-none font-medium">{etiket}</span>}
      </div>
      <div className="col-span-2 row-start-2 flex min-w-0 flex-col gap-1.5 sm:col-span-1 sm:col-start-2 sm:row-start-1">
        {children}
        {hata ? (
          <p id={ad ? `${ad}-hata` : undefined} className="text-sm text-destructive">
            {hata}
          </p>
        ) : aciklama ? (
          <p className="text-xs text-muted-foreground">{aciklama}</p>
        ) : null}
      </div>
      {/* Dar ekranda etiketin yanında, genişte girdinin sağında. */}
      {ek ? <div className="col-start-2 row-start-1 flex min-h-8 items-center sm:col-start-3">{ek}</div> : null}
    </div>
  );
}
