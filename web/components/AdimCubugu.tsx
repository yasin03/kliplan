import Link from "next/link";
import { cn } from "@/lib/utils";

const ADIMLAR = [
  { yol: "bilgiler", ad: "Bilgiler" },
  { yol: "fotograflar", ad: "Fotoğraflar" },
  { yol: null, ad: "Senaryo" },
  { yol: null, ad: "Video" },
] as const;

/** Yeni ilan akışının adımları. Senaryo ve video adımları kuyruk eklenince (6.5) açılacak. */
export function AdimCubugu({ ilanId, etkin }: { ilanId: string | null; etkin: "bilgiler" | "fotograflar" }) {
  return (
    <ol className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
      {ADIMLAR.map((adim, i) => {
        const aktif = adim.yol === etkin;
        const metin = (
          <>
            <span className={cn("grid size-6 place-items-center rounded-full border text-xs", aktif && "border-primary bg-primary text-primary-foreground")}>{i + 1}</span>
            {adim.ad}
          </>
        );
        return (
          <li key={adim.ad} className={cn("flex items-center gap-2", aktif ? "font-medium" : "text-muted-foreground")} aria-current={aktif ? "step" : undefined}>
            {adim.yol && ilanId && !aktif ? (
              <Link href={`/ilan/${ilanId}/${adim.yol}`} className="flex items-center gap-2 hover:text-foreground">
                {metin}
              </Link>
            ) : (
              metin
            )}
          </li>
        );
      })}
    </ol>
  );
}
