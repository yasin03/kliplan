"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { uretimBaslat } from "../eylemler";

type Props = {
  ilanId: string;
  tur: "senaryo" | "video";
  etiket: string;
  zorla?: boolean;
  /** Verilirse başlatmadan önce sorulur (ör. ücretli yeniden üretim). */
  onay?: string;
  variant?: "default" | "outline";
  disabled?: boolean;
};

export function UretimButonu({ ilanId, tur, etiket, zorla = false, onay, variant = "default", disabled }: Props) {
  const [bekliyor, gecis] = useTransition();
  const [hata, setHata] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-1">
      <Button
        variant={variant}
        size="lg"
        disabled={disabled || bekliyor}
        onClick={() => {
          if (onay && !confirm(onay)) return;
          gecis(async () => setHata((await uretimBaslat(ilanId, tur, zorla)).hata));
        }}
      >
        {bekliyor ? "Başlatılıyor…" : etiket}
      </Button>
      {hata ? <p className="max-w-md text-sm text-destructive">{hata}</p> : null}
    </div>
  );
}
