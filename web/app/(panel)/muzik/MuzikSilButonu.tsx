"use client";

import { Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { muzikSil } from "./eylemler";

export function MuzikSilButonu({ muzikId, ad }: { muzikId: string; ad: string }) {
  const [bekliyor, gecis] = useTransition();
  const [hata, setHata] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="ghost"
        size="sm"
        disabled={bekliyor}
        onClick={() => {
          if (!confirm(`"${ad}" silinsin mi? Üretilmiş videolar etkilenmez; bu müziği kullanan ilanlar şirketin varsayılan müziğine döner.`)) return;
          gecis(async () => setHata((await muzikSil(muzikId)).hata));
        }}
      >
        <Trash2 /> {bekliyor ? "Siliniyor…" : "Sil"}
      </Button>
      {hata ? <p className="text-sm text-destructive">{hata}</p> : null}
    </div>
  );
}
