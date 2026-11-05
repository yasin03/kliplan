import { CircleCheck, CircleDashed, Pencil } from "lucide-react";
import Link from "next/link";
import { tutarlilikKontrolu } from "@cekirdek/pipeline/dogrulama.js";
import { KontrolRaporu } from "@cekirdek/pipeline/kontrolRaporu.js";
import { cozunurlukUyarisi } from "@cekirdek/veri/fotografIsleme.js";
import { ilanBilgiSemasi, type IlanBilgileri, ilanJsonuOlustur } from "@cekirdek/veri/ilanFormu.js";
import { DurumRozeti } from "@/components/DurumRozeti";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { bulunamazsa404 } from "@/lib/hatalar";
import { fiyatMetni, ilanBasligi, tarihMetni } from "@/lib/ilan";
import { girisGerekli } from "@/lib/oturum";
import { IlanSilButonu } from "./IlanSilButonu";

export default async function IlanSayfasi({ params }: PageProps<"/ilan/[id]">) {
  const { id } = await params;
  const { depo, yetki } = await girisGerekli();
  const [ilan, ofis, fotograflar] = await bulunamazsa404(Promise.all([depo.ilan(id), depo.ilanOfisi(id), depo.fotograflar(id)]));
  const veri = ilan.veri as Partial<IlanBilgileri>;

  // Pipeline'ın göreceği ilan.json; eksikler ve uyarılar videoya geçmeden burada gösterilir.
  const json = ilanJsonuOlustur(ilan.veri, ofis, fotograflar);
  const rapor = new KontrolRaporu();
  if (json.basarili) tutarlilikKontrolu(json.ilan, rapor);
  const dusukCozunurluk = fotograflar.filter((f) => cozunurlukUyarisi(f.genislik, f.yukseklik)).length;
  const uyarilar = [
    ...rapor.uyarilar.map((u) => `${u.alan}: ${u.mesaj}`),
    ...(dusukCozunurluk ? [`${dusukCozunurluk} fotoğraf düşük çözünürlüklü; videoda bulanık görünebilir.`] : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">{ilanBasligi(veri)}</h1>
          <p className="text-sm text-muted-foreground">
            {[fiyatMetni(veri), yetki.admin ? ofis.ad : null, `Güncelleme: ${tarihMetni(ilan.guncelleme)}`].filter(Boolean).join(" · ")}
          </p>
        </div>
        <DurumRozeti durum={ilan.durum} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <AdimKarti
          baslik="1. Bilgiler"
          tamam={ilanBilgiSemasi.safeParse(ilan.veri).success}
          ozet={veri.ilanNo ? `İlan no ${veri.ilanNo}` : "Eksik"}
          duzenle={`/ilan/${id}/bilgiler`}
        />
        <AdimKarti
          baslik="2. Fotoğraflar"
          tamam={fotograflar.length > 0}
          ozet={fotograflar.length ? `${fotograflar.length} fotoğraf` : "Henüz fotoğraf yok"}
          duzenle={`/ilan/${id}/fotograflar`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Videoya hazırlık</CardTitle>
          <CardDescription>
            {json.basarili
              ? "Bilgiler ve fotoğraflar tamam. Senaryo ve video üretimi bir sonraki sürümde bu ekrana eklenecek."
              : "Video üretilebilmesi için şunlar tamamlanmalı:"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          {!json.basarili ? (
            <ul className="list-disc pl-5 text-destructive">
              {json.hatalar.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          ) : null}
          {uyarilar.length ? (
            <div>
              <p className="font-medium">Kontrol edin</p>
              <ul className="list-disc pl-5 text-amber-800">
                {uyarilar.map((u) => (
                  <li key={u}>{u}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex justify-between gap-2">
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          Tüm ilanlar
        </Link>
        <IlanSilButonu ilanId={id} />
      </div>
    </div>
  );
}

function AdimKarti({ baslik, tamam, ozet, duzenle }: { baslik: string; tamam: boolean; ozet: string; duzenle: string }) {
  const Simge = tamam ? CircleCheck : CircleDashed;
  return (
    <Card>
      <CardContent className="flex items-center gap-3">
        <Simge className={tamam ? "size-6 text-green-600" : "size-6 text-muted-foreground"} aria-label={tamam ? "Tamam" : "Eksik"} />
        <div className="flex-1">
          <p className="font-medium">{baslik}</p>
          <p className="text-sm text-muted-foreground">{ozet}</p>
        </div>
        <Link href={duzenle} className={buttonVariants({ variant: "outline", size: "sm" })}>
          <Pencil /> Düzenle
        </Link>
      </CardContent>
    </Card>
  );
}
