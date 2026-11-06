"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  acik: boolean;
  onDegistir: (acik: boolean) => void;
  /** Ekran okuyucu için, ör. "Fiyat videoda gösterilsin". */
  etiket: string;
  devreDisi?: boolean | undefined;
};

/** Açık/kapalı anahtarı (switch). Yanında "Videoda" yazar; kapalıyken soluklaşır. */
export function Anahtar({ acik, onDegistir, etiket, devreDisi }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={acik}
      aria-label={etiket}
      title={acik ? "Videoda gösteriliyor" : "Videoda gösterilmiyor"}
      disabled={devreDisi}
      onClick={() => onDegistir(!acik)}
      className="group inline-flex shrink-0 items-center gap-2 rounded-full text-xs text-muted-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className={cn("relative h-5 w-9 rounded-full transition-colors", acik ? "bg-primary" : "bg-input")}>
        <span className={cn("absolute top-0.5 left-0.5 size-4 rounded-full bg-background shadow transition-transform", acik && "translate-x-4")} />
      </span>
      <span className={cn("w-14 text-left", !acik && "line-through")}>Videoda</span>
    </button>
  );
}

/** Formda "videoda göster" anahtarı: kapalıyken `gizle.<alan>` "on" gönderilir. Varsayılan açık. */
export function GosterAnahtari({ alan, etiket, baslangic }: { alan: string; etiket: string; baslangic: boolean }) {
  const [acik, setAcik] = useState(baslangic);
  return (
    <>
      <Anahtar acik={acik} onDegistir={setAcik} etiket={`${etiket} videoda gösterilsin`} />
      {acik ? null : <input type="hidden" name={`gizle.${alan}`} value="on" />}
    </>
  );
}
