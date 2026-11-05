import { Badge } from "@/components/ui/badge";
import { DURUM_ADLARI, type IlanDurumu } from "@/lib/ilan";

const RENKLER: Record<IlanDurumu, string> = {
  taslak: "bg-secondary text-secondary-foreground",
  uretiliyor: "bg-blue-100 text-blue-800",
  kontrol_bekliyor: "bg-amber-100 text-amber-900",
  onaylandi: "bg-green-100 text-green-800",
  hata: "bg-destructive/10 text-destructive",
};

export function DurumRozeti({ durum }: { durum: IlanDurumu }) {
  return <Badge className={RENKLER[durum]}>{DURUM_ADLARI[durum]}</Badge>;
}
