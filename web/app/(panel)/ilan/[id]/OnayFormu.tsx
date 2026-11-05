"use client";

import { CircleCheck } from "lucide-react";
import { useState, useTransition } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { videoOnayla } from "../eylemler";

type Props = { ilanId: string; videoId: string; maddeler: { kod: string; metin: string }[] };

/** Emlakçı videoyu izleyip maddeleri işaretler; hepsi işaretlenmeden onay butonu açılmaz. */
export function OnayFormu({ ilanId, videoId, maddeler }: Props) {
  const [isaretli, setIsaretli] = useState<Set<string>>(new Set());
  const [bekliyor, gecis] = useTransition();
  const [hata, setHata] = useState<string | null>(null);
  const tamam = maddeler.every((m) => isaretli.has(m.kod));

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {maddeler.map((m) => (
          <li key={m.kod}>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-4 shrink-0 accent-primary"
                checked={isaretli.has(m.kod)}
                onChange={(e) =>
                  setIsaretli((onceki) => {
                    const yeni = new Set(onceki);
                    if (e.target.checked) yeni.add(m.kod);
                    else yeni.delete(m.kod);
                    return yeni;
                  })
                }
              />
              {m.metin}
            </label>
          </li>
        ))}
      </ul>
      {hata ? (
        <Alert variant="destructive" aria-live="polite">
          <AlertDescription>{hata}</AlertDescription>
        </Alert>
      ) : null}
      <div>
        <Button size="lg" disabled={!tamam || bekliyor} onClick={() => gecis(async () => setHata((await videoOnayla(ilanId, videoId, [...isaretli])).hata))}>
          <CircleCheck /> {bekliyor ? "Onaylanıyor…" : "Videoyu onayla"}
        </Button>
        {!tamam ? <p className="mt-1 text-xs text-muted-foreground">Onaylamak için bütün maddeleri işaretleyin.</p> : null}
      </div>
    </div>
  );
}
