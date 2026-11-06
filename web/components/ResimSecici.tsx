"use client";

import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

export type ResimSecenegi = {
  /** Form değeri: "" şirket varsayılanı, "yok" resimsiz, diğerleri resim kimliği. */
  deger: string;
  etiket: string;
  /** Küçük görsel için kısa ömürlü bağlantı; yoksa simge gösterilir. */
  adres: string | null;
};

type Props = {
  ad: string;
  secenekler: ResimSecenegi[];
  /** Kontrollü kullanım (ilan sayfası kartı). */
  deger?: string;
  onDegistir?: (deger: string) => void;
  /** Kontrolsüz kullanım (form gönderimi). */
  varsayilan?: string;
  devreDisi?: boolean;
  /** `logo`: yatay, koyu zeminde, kırpılmadan. Varsayılan dikey resim. */
  bicim?: "dikey" | "logo";
};

/** Kapanış arka planı veya logo seçimi: küçük görseller arasında radyo düğmeleri. */
export function ResimSecici({ ad, secenekler, deger, onDegistir, varsayilan, devreDisi, bicim = "dikey" }: Props) {
  const oran = bicim === "logo" ? "aspect-[2/1]" : "aspect-[9/16]";
  return (
    <fieldset className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6" disabled={devreDisi}>
      {secenekler.map((s) => (
        <label
          key={s.deger || "varsayilan"}
          className={cn(
            "flex cursor-pointer flex-col gap-1 rounded-lg border bg-background p-1.5 text-xs has-[:checked]:border-primary has-[:checked]:ring-2 has-[:checked]:ring-primary",
            "has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60",
          )}
        >
          <input
            type="radio"
            name={ad}
            value={s.deger}
            className="sr-only"
            {...(onDegistir ? { checked: deger === s.deger, onChange: () => onDegistir(s.deger) } : { defaultChecked: (varsayilan ?? "") === s.deger })}
          />
          {s.adres ? (
            <img
              src={s.adres}
              alt=""
              className={cn(oran, "w-full rounded", bicim === "logo" ? "bg-[#0B1F3A] object-contain p-2" : "object-cover")}
              loading="lazy"
            />
          ) : (
            <span className={cn(oran, "flex w-full items-center justify-center rounded bg-muted text-muted-foreground")}>
              <ImageOff className="size-5" aria-hidden />
            </span>
          )}
          <span className="line-clamp-2 px-0.5">{s.etiket}</span>
        </label>
      ))}
    </fieldset>
  );
}
