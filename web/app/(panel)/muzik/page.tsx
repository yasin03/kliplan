import { MUZIK_BEYANI } from "@cekirdek/veri/gorunum.js";
import { MUZIK_EN_BUYUK_MB } from "@cekirdek/veri/gorunumIsleme.js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { tarihMetni } from "@/lib/ilan";
import { girisGerekli } from "@/lib/oturum";
import { MuzikSilButonu } from "./MuzikSilButonu";
import { MuzikYukleme } from "./MuzikYukleme";

const sureMetni = (sn: number) => `${Math.floor(sn / 60)}:${String(Math.round(sn % 60)).padStart(2, "0")}`;

export default async function MuzikSayfasi({ searchParams }: PageProps<"/muzik">) {
  const { depo, yetki } = await girisGerekli();
  const secilen = (await searchParams).ofis;
  const ofisId = yetki.admin && typeof secilen === "string" && secilen ? secilen : undefined;
  const [muzikler, ofisler] = await Promise.all([depo.muzikler(ofisId), yetki.admin ? depo.ofisler() : []]);
  const ofisAdi = new Map(ofisler.map((o) => [o.id, o.ad]));
  const adresler = await Promise.all(muzikler.map((m) => depo.muzikBaglantisi(m.id)));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Müzik</h1>
        <p className="text-sm text-muted-foreground">
          Fon müziği dış sesin altında düşük seviyede çalar. Yalnızca ticari kullanım izni olan müzik kullanılabilir; izin bilgisi her videonun kontrol raporuna yazılır.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Müzikler</CardTitle>
          <CardDescription>
            Kütüphanedeki müziklerin lisansını Kliplan sağlar. Şirketinizin yüklediği müziklerin izni sizin beyanınıza dayanır. Silinen müzik üretilmiş videoları
            etkilemez; kullanan ilanlar şirketin varsayılan müziğine döner.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {muzikler.length === 0 ? (
            <p className="text-sm text-muted-foreground">Henüz müzik yok.</p>
          ) : (
            <ul className="flex flex-col divide-y rounded-lg border">
              {muzikler.map((m, i) => (
                <li key={m.id} className="flex flex-col gap-2 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">{m.ad}</p>
                      <p className="text-sm text-muted-foreground">
                        {[m.ofisId === null ? "Kütüphane" : yetki.admin ? `Şirket yüklemesi: ${ofisAdi.get(m.ofisId) ?? "?"}` : "Şirketinizin yüklemesi", sureMetni(m.sureSn)].join(" · ")}
                      </p>
                      <p className="text-sm break-words">Lisans: {m.lisans}</p>
                      {m.beyan ? (
                        <p className="text-xs text-muted-foreground">
                          Beyan: {m.beyanEdenAd}, {tarihMetni(m.olusturma)}
                        </p>
                      ) : null}
                    </div>
                    {m.ofisId !== null || yetki.admin ? <MuzikSilButonu muzikId={m.id} ad={m.ad} /> : null}
                  </div>
                  <audio controls preload="none" src={adresler[i]} className="h-9 w-full max-w-md" />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {yetki.admin && ofisId === undefined ? (
        <MuzikYukleme kutuphane enBuyukMb={MUZIK_EN_BUYUK_MB} beyanMetni={MUZIK_BEYANI} />
      ) : yetki.admin ? null : (
        <MuzikYukleme kutuphane={false} enBuyukMb={MUZIK_EN_BUYUK_MB} beyanMetni={MUZIK_BEYANI} />
      )}
    </div>
  );
}
