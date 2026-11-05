import { CircleCheck, CircleDashed, Pencil } from "lucide-react";
import Link from "next/link";
import { tutarlilikKontrolu } from "@cekirdek/pipeline/dogrulama.js";
import { KontrolRaporu } from "@cekirdek/pipeline/kontrolRaporu.js";
import { cozunurlukUyarisi } from "@cekirdek/veri/fotografIsleme.js";
import { ilanBilgiSemasi, type IlanBilgileri } from "@cekirdek/veri/ilanFormu.js";
import { DurumRozeti } from "@/components/DurumRozeti";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { bulunamazsa404 } from "@/lib/hatalar";
import { boyutMetni, fiyatMetni, ilanBasligi, isOzeti, tarihMetni } from "@/lib/ilan";
import { ilanBaglami } from "@/lib/ilanBaglami";
import { girisGerekli } from "@/lib/oturum";
import { IlanSilButonu } from "./IlanSilButonu";
import { UretimButonu } from "./UretimButonu";
import { UretimDurumu } from "./UretimDurumu";
import { VideoBolumu } from "./VideoBolumu";

export default async function IlanSayfasi({ params }: PageProps<"/ilan/[id]">) {
  const { id } = await params;
  const { depo, yetki } = await girisGerekli();
  const [{ ilan, ofis, fotograflar, json }, sonIs, videolar] = await bulunamazsa404(Promise.all([ilanBaglami(depo, id), depo.sonIs(id), depo.videolar(id)]));
  const veri = ilan.veri as Partial<IlanBilgileri>;
  const uretiliyor = ilan.durum === "uretiliyor";
  const senaryoVar = Boolean(ilan.senaryo);
  const sonVideo = videolar[0];

  // Pipeline'ın göreceği ilan.json; eksikler ve uyarılar videoya geçmeden burada gösterilir.
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

      <UretimDurumu ilanId={id} uretiliyor={uretiliyor} hataVar={ilan.durum === "hata"} is={isOzeti(sonIs)} />

      <VideoBolumu depo={depo} ilanId={id} durum={ilan.durum} videolar={videolar} ilan={json.basarili ? json.ilan : null} />

      <div className="grid gap-4 sm:grid-cols-2">
        <AdimKarti
          baslik="1. Bilgiler"
          tamam={ilanBilgiSemasi.safeParse(ilan.veri).success}
          ozet={veri.ilanNo ? `İlan no ${veri.ilanNo}` : "Eksik"}
          duzenle={`/ilan/${id}/bilgiler`}
          kilitli={uretiliyor}
        />
        <AdimKarti
          baslik="2. Fotoğraflar"
          tamam={fotograflar.length > 0}
          ozet={fotograflar.length ? `${fotograflar.length} fotoğraf` : "Henüz fotoğraf yok"}
          duzenle={`/ilan/${id}/fotograflar`}
          kilitli={uretiliyor}
        />
        <AdimKarti
          baslik="3. Senaryo"
          tamam={senaryoVar}
          ozet={senaryoVar ? "Hazır; kontrol edip düzenleyebilirsiniz" : "Henüz üretilmedi"}
          duzenle={`/ilan/${id}/senaryo`}
          duzenleEtiketi={senaryoVar ? "Düzenle" : "Aç"}
        />
        <AdimKarti
          baslik="4. Video"
          tamam={Boolean(sonVideo) && (ilan.durum === "kontrol_bekliyor" || ilan.durum === "onaylandi")}
          ozet={sonVideo ? `Sürüm ${sonVideo.surum} · ${sonVideo.sureSn.toFixed(1)} sn · ${boyutMetni(sonVideo.boyutBayt)}` : "Henüz üretilmedi"}
        />
      </div>

      {json.basarili && !uretiliyor ? (
        <Card>
          <CardHeader>
            <CardTitle>Sıradaki adım</CardTitle>
            <CardDescription>
              {!senaryoVar
                ? "Önce senaryoyu üretin; video üretilmeden önce metinleri görüp düzenleyebilirsiniz."
                : ilan.durum === "kontrol_bekliyor"
                  ? "Video hazır. Yukarıda izleyip kontrol listesini tamamlayın. Beğenmediyseniz senaryoyu düzenleyip yeniden üretebilirsiniz."
                  : ilan.durum === "onaylandi"
                    ? "Video onaylandı ve indirilebilir. Değişiklik gerekirse senaryoyu düzenleyip yeni sürüm üretebilirsiniz."
                    : "Senaryo hazır. Kontrol ettiyseniz videoyu üretin."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {!senaryoVar ? (
              <UretimButonu ilanId={id} tur="senaryo" etiket="Senaryoyu üret" />
            ) : (
              <>
                <Link href={`/ilan/${id}/senaryo`} className={buttonVariants({ variant: "outline", size: "lg" })}>
                  Senaryoyu gör
                </Link>
                <UretimButonu ilanId={id} tur="video" etiket={sonVideo ? "Videoyu yeniden üret" : "Videoyu üret"} variant={sonVideo ? "outline" : "default"} />
              </>
            )}
          </CardContent>
        </Card>
      ) : null}

      {!json.basarili || uyarilar.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Videoya hazırlık</CardTitle>
            {!json.basarili ? <CardDescription>Video üretilebilmesi için şunlar tamamlanmalı:</CardDescription> : null}
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
      ) : null}

      <div className="flex justify-between gap-2">
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          Tüm ilanlar
        </Link>
        {!uretiliyor ? <IlanSilButonu ilanId={id} /> : null}
      </div>
    </div>
  );
}

function AdimKarti(p: { baslik: string; tamam: boolean; ozet: string; duzenle?: string; duzenleEtiketi?: string; kilitli?: boolean }) {
  const Simge = p.tamam ? CircleCheck : CircleDashed;
  return (
    <Card>
      <CardContent className="flex items-center gap-3">
        <Simge className={p.tamam ? "size-6 text-green-600" : "size-6 text-muted-foreground"} aria-label={p.tamam ? "Tamam" : "Eksik"} />
        <div className="flex-1">
          <p className="font-medium">{p.baslik}</p>
          <p className="text-sm text-muted-foreground">{p.ozet}</p>
        </div>
        {p.duzenle && !p.kilitli ? (
          <Link href={p.duzenle} className={buttonVariants({ variant: "outline", size: "sm" })}>
            <Pencil /> {p.duzenleEtiketi ?? "Düzenle"}
          </Link>
        ) : null}
      </CardContent>
    </Card>
  );
}
