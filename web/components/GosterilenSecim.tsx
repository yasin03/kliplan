"use client";

import { useState } from "react";
import { Anahtar } from "@/components/Anahtar";
import { ResimSecici, type ResimSecenegi } from "@/components/ResimSecici";

type Ortak = {
  ad: string;
  etiket: string;
  aciklama: string;
  /** "Şirket varsayılanı" ("") ve kayıtlar; "yok" anahtarla seçilir, listede olmaz. */
  secenekler: ResimSecenegi[];
  bicim?: "dikey" | "logo";
  devreDisi?: boolean;
};

/**
 * Logo veya kapanış resmi: "videoda göster" anahtarı ve küçük görsellerden seçim. Değer `secimDegeri` biçiminde:
 * "" şirket varsayılanı, "yok" (anahtar kapalı) veya kimlik. Kontrollü (`deger`/`onDegistir`) ya da formda (`varsayilan`, gizli girdi) kullanılır.
 */
export function GosterilenSecim(p: Ortak & ({ deger: string; onDegistir: (deger: string) => void } | { varsayilan: string })) {
  const [ic, setIc] = useState("varsayilan" in p ? p.varsayilan : "");
  const deger = "deger" in p ? p.deger : ic;
  const degistir = "deger" in p ? p.onDegistir : setIc;
  // Anahtar kapatılıp açılınca son seçim geri gelir.
  const [sonSecim, setSonSecim] = useState(deger === "yok" ? "" : deger);
  const acik = deger !== "yok";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium">{p.etiket}</p>
          <p className="text-xs text-muted-foreground">{p.aciklama}</p>
        </div>
        <Anahtar acik={acik} onDegistir={(a) => degistir(a ? sonSecim : "yok")} etiket={`${p.etiket} videoda gösterilsin`} devreDisi={p.devreDisi} />
      </div>
      {acik ? (
        <ResimSecici
          ad={`${p.ad}.secenek`}
          secenekler={p.secenekler}
          deger={deger}
          onDegistir={(d) => {
            setSonSecim(d);
            degistir(d);
          }}
          bicim={p.bicim ?? "dikey"}
          devreDisi={p.devreDisi ?? false}
        />
      ) : null}
      {"varsayilan" in p ? <input type="hidden" name={p.ad} value={deger} /> : null}
    </div>
  );
}
