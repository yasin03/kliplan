import { Plus } from "lucide-react";
import Link from "next/link";
import type { IlanBilgileri } from "@cekirdek/veri/ilanFormu.js";
import { DurumRozeti } from "@/components/DurumRozeti";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fiyatMetni, ilanBasligi, tarihMetni } from "@/lib/ilan";
import { girisGerekli } from "@/lib/oturum";

export default async function IlanlarSayfasi() {
  const { depo, yetki } = await girisGerekli();
  const [ilanlar, ofisler] = await Promise.all([depo.ilanlar(), yetki.admin ? depo.ofisler() : []]);
  const ofisAdi = new Map(ofisler.map((o) => [o.id, o.ad]));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">İlanlar</h1>
        <Link href="/ilan/yeni" className={buttonVariants({ size: "lg" })}>
          <Plus /> Yeni ilan
        </Link>
      </div>

      {ilanlar.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Henüz ilan yok</CardTitle>
            <CardDescription>İlk ilanınızı ekleyin: bilgileri girin, fotoğrafları yükleyin, video hazırlansın.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/ilan/yeni" className={buttonVariants()}>
              Yeni ilan ekle
            </Link>
          </CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col divide-y overflow-hidden rounded-xl border bg-background">
          {ilanlar.map((ilan) => {
            const veri = ilan.veri as Partial<IlanBilgileri>;
            return (
              <li key={ilan.id}>
                <Link href={`/ilan/${ilan.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-muted/50">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{ilanBasligi(veri)}</span>
                    <span className="block text-sm text-muted-foreground">
                      {[fiyatMetni(veri), yetki.admin ? ofisAdi.get(ilan.ofisId) : null, `Güncelleme: ${tarihMetni(ilan.guncelleme)}`].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <DurumRozeti durum={ilan.durum} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
