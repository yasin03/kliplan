import Link from "next/link";
import { EN_FAZLA_SIRKET_LOGOSU, EN_FAZLA_SIRKET_RESMI } from "@cekirdek/veri/depo.js";
import { EN_BUYUK_DOSYA_MB } from "@cekirdek/veri/fotografIsleme.js";
import { ofisTemasi } from "@cekirdek/veri/gorunum.js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { gorunumSecenekleri } from "@/lib/gorunumSecenekleri";
import { bulunamazsa404 } from "@/lib/hatalar";
import { girisGerekli } from "@/lib/oturum";
import { AyarlarFormu } from "./AyarlarFormu";
import { LogoBolumu } from "./LogoBolumu";
import { ResimBolumu } from "./ResimBolumu";

export default async function AyarlarSayfasi({ searchParams }: PageProps<"/ayarlar">) {
  const { depo, yetki } = await girisGerekli();
  const secilen = (await searchParams).ofis;
  const istenen = typeof secilen === "string" && secilen ? secilen : undefined;

  // Admin bir ofise bağlı değil; önce hangi ofisin ayarlarını düzenleyeceğini seçer.
  if (yetki.admin && !istenen) {
    const ofisler = await depo.ofisler();
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold">Şirket ayarları</h1>
        <Card>
          <CardHeader>
            <CardTitle>Şirket seçin</CardTitle>
            <CardDescription>Yönetici olarak hangi şirketin ayarlarını düzenleyeceğinizi seçin.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y rounded-lg border">
              {ofisler.map((o) => (
                <li key={o.id}>
                  <Link href={`/ayarlar?ofis=${o.id}`} className="block px-3 py-2 hover:bg-muted/50">
                    {o.ad}
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    );
  }

  const ofis = await bulunamazsa404(depo.ayarlanacakOfis(istenen));
  const secenekler = await gorunumSecenekleri(depo, ofis);
  const ofisId = yetki.admin ? ofis.id : null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Şirket ayarları</h1>
        <p className="text-sm text-muted-foreground">{ofis.ad} · Ayarlar yalnızca bundan sonra üretilen videolara uygulanır; üretilmiş videolar değişmez.</p>
      </div>
      <LogoBolumu ofisId={ofisId} logolar={secenekler.logolar} enFazla={EN_FAZLA_SIRKET_LOGOSU} />
      <ResimBolumu ofisId={ofisId} resimler={secenekler.resimler} enFazla={EN_FAZLA_SIRKET_RESMI} enBuyukMb={EN_BUYUK_DOSYA_MB} />
      <AyarlarFormu
        ofisId={ofisId}
        baslangic={{
          ad: ofis.ad,
          adres: ofis.adres ?? "",
          il: ofis.il ?? "",
          ilce: ofis.ilce ?? "",
          cepTelefonu: ofis.cepTelefonu ?? "",
          eposta: ofis.eposta ?? "",
          web: ofis.web ?? "",
          yetkiliAdi: ofis.yetkiliAdi ?? "",
          yetkiliSoyadi: ofis.yetkiliSoyadi ?? "",
          ...Object.fromEntries(ofis.kapanisAlanlari.map((k) => [`kapanis.${k}`, "on"])),
          varsayilanResimId: ofis.varsayilanResimId ?? "",
          varsayilanLogoId: ofis.varsayilanLogoId ?? "",
          telefon: ofis.telefon ?? "",
          yetkiBelgeNo: ofis.yetkiBelgeNo ?? "",
          tema: ofisTemasi(ofis),
          vurguKendi: ofis.vurguRengi ? "on" : "",
          vurguRengi: ofis.vurguRengi ?? "",
          varsayilanMuzikId: ofis.varsayilanMuzikId ?? "",
        }}
        muzikler={secenekler.muzikler}
        resimler={secenekler.resimler}
        logolar={secenekler.logolar}
      />
    </div>
  );
}
