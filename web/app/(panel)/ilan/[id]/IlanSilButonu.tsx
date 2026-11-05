"use client";

import { Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ilanSil } from "../eylemler";

export function IlanSilButonu({ ilanId }: { ilanId: string }) {
  const [bekliyor, gecis] = useTransition();
  const [hata, setHata] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="destructive"
        disabled={bekliyor}
        onClick={() => {
          if (!confirm("İlan, fotoğrafları ve videolarıyla birlikte kalıcı olarak silinsin mi? Bu işlem geri alınamaz.")) return;
          gecis(async () => setHata((await ilanSil(ilanId)).hata));
        }}
      >
        <Trash2 /> {bekliyor ? "Siliniyor…" : "İlanı sil"}
      </Button>
      {hata ? <p className="text-sm text-destructive">{hata}</p> : null}
    </div>
  );
}
