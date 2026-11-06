"use client";

import { CircleCheck, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { VURGU_DESENI, vurguHatasi } from "@cekirdek/pipeline/renk.js";
import { TEMA_ADLARI, type TemaAdi, TEMALAR } from "@cekirdek/remotion/temalar.js";
import { KAPANIS_ALANI_ADLARI, KAPANIS_ALANLARI } from "@cekirdek/veri/kapanisAlanlari.js";
import type { FormAlanlari } from "@cekirdek/veri/ilanFormu.js";
import { FormSatiri } from "@/components/FormSatiri";
import { ResimSecici, type ResimSecenegi } from "@/components/ResimSecici";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import { type AyarDurumu, ofisAyarlariniKaydet } from "./eylemler";

type Props = {
  ofisId: string | null;
  baslangic: FormAlanlari;
  muzikler: { id: string; ad: string; kutuphane: boolean }[];
  resimler: ResimSecenegi[];
  logolar: ResimSecenegi[];
};

export function AyarlarFormu({ ofisId, baslangic, muzikler, resimler, logolar }: Props) {
  const [durum, gonder, bekliyor] = useActionState<AyarDurumu, FormData>(ofisAyarlariniKaydet.bind(null, ofisId), {
    hatalar: {},
    mesaj: null,
    kaydedildi: false,
    degerler: baslangic,
  });
  const { degerler: d, hatalar: h } = durum;

  return (
    // Gönderimden sonra React formu sıfırlar; anahtar değişince alanlar dönen değerlerle yeniden kurulur.
    <form action={gonder} key={JSON.stringify(d)} className="flex flex-col gap-4" noValidate>
      <Card>
        <CardHeader>
          <CardTitle>Şirket bilgileri</CardTitle>
          <CardDescription>
            Şirket adı videoda ve dış seste geçer. Yeni ilan formu telefon (önce cep) ve yetki belgesiyle başlar; her ilanda yine doğrulamanız istenir.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Metin ad="ad" etiket="Şirket adı" d={d} h={h} />
          <Metin ad="yetkiBelgeNo" etiket="Yetki belge numarası" d={d} h={h} sayisal />
          <Metin ad="yetkiliAdi" etiket="Yetkili adı" d={d} h={h} />
          <Metin ad="yetkiliSoyadi" etiket="Yetkili soyadı" d={d} h={h} />
          <Metin ad="telefon" etiket="Sabit telefon" d={d} h={h} tur="tel" yerTutucu="0272 212 00 00" />
          <Metin ad="cepTelefonu" etiket="Cep telefonu" d={d} h={h} tur="tel" yerTutucu="0505 709 44 88" />
          <Metin ad="eposta" etiket="E-posta" d={d} h={h} tur="email" yerTutucu="bilgi@ornekemlak.com" />
          <Metin ad="web" etiket="Web adresi" d={d} h={h} yerTutucu="ornekemlak.com" />
          <Metin ad="adres" etiket="Adres" d={d} h={h} yerTutucu="Mahalle, cadde/sokak, no" />
          <Metin ad="il" etiket="İl" d={d} h={h} />
          <Metin ad="ilce" etiket="İlçe" d={d} h={h} />
          <p className="text-xs text-muted-foreground">
            Adı değiştirirseniz mevcut ilanların senaryosu eski adı içerir; video üretmeden önce senaryoyu yeniden üretmeniz veya son sahneyi düzenlemeniz gerekir.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Kapanış kartında göster</CardTitle>
          <CardDescription>Videonun son sahnesinde fiyat, telefon, şirket adı ve yetki belgesinin yanında bunlar da yazar. Boş bıraktığınız bilgi seçilemez.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {KAPANIS_ALANLARI.map((k) => (
            <div key={k}>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name={`kapanis.${k}`} defaultChecked={d[`kapanis.${k}`] === "on"} className="size-4 accent-primary" />
                {KAPANIS_ALANI_ADLARI[k]}
              </label>
              {h[`kapanis.${k}`] ? <p className="pl-6 text-sm text-destructive">{h[`kapanis.${k}`]}</p> : null}
            </div>
          ))}
        </CardContent>
      </Card>

      <GorunumAlanlari d={d} h={h} />

      <Card>
        <CardHeader>
          <CardTitle>Fon müziği</CardTitle>
          <CardDescription>
            Yeni ilanlarda varsayılan olarak çalar; her ilanda değiştirilebilir veya kapatılabilir.{" "}
            <Link href={ofisId ? `/muzik?ofis=${ofisId}` : "/muzik"} className="underline">
              Müzikleri dinleyin veya kendi müziğinizi yükleyin
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FormSatiri ad="varsayilanMuzikId" etiket="Varsayılan müzik" hata={h.varsayilanMuzikId}>
            <NativeSelect id="varsayilanMuzikId" name="varsayilanMuzikId" defaultValue={d.varsayilanMuzikId ?? ""} className="w-full">
              <NativeSelectOption value="">Müziksiz</NativeSelectOption>
              <MuzikSecenekleri muzikler={muzikler} />
            </NativeSelect>
          </FormSatiri>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Varsayılan logo</CardTitle>
          <CardDescription>Yeni ilanlarda bu logo görünür; her ilanda başka bir logo seçilebilir veya logo kapatılabilir. Logoları yukarıdaki "Logolar" bölümünden yükleyin.</CardDescription>
        </CardHeader>
        <CardContent>
          <ResimSecici ad="varsayilanLogoId" secenekler={[{ deger: "", etiket: "Logo yok", adres: null }, ...logolar]} varsayilan={d.varsayilanLogoId ?? ""} bicim="logo" />
          {h.varsayilanLogoId ? <p className="text-sm text-destructive">{h.varsayilanLogoId}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Varsayılan kapanış arka planı</CardTitle>
          <CardDescription>Yeni ilanlarda son sahnenin arkasında bu resim görünür; her ilanda değiştirilebilir. Resimleri yukarıdaki "Şirket resimleri" bölümünden yükleyin.</CardDescription>
        </CardHeader>
        <CardContent>
          <ResimSecici ad="varsayilanResimId" secenekler={[{ deger: "", etiket: "İlan fotoğrafı", adres: null }, ...resimler]} varsayilan={d.varsayilanResimId ?? ""} />
        </CardContent>
      </Card>

      {durum.uyari && !bekliyor ? (
        <Alert aria-live="polite">
          <TriangleAlert />
          <AlertDescription>{durum.uyari}</AlertDescription>
        </Alert>
      ) : null}

      {durum.mesaj ? (
        <Alert variant="destructive" aria-live="polite">
          <AlertDescription>{durum.mesaj}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex items-center justify-end gap-3">
        {durum.kaydedildi && !bekliyor ? (
          <span className="text-sm text-green-700" aria-live="polite">
            Kaydedildi.
          </span>
        ) : null}
        <Button type="submit" size="lg" disabled={bekliyor}>
          {bekliyor ? "Kaydediliyor…" : "Kaydet"}
        </Button>
      </div>
    </form>
  );
}

export function MuzikSecenekleri({ muzikler }: { muzikler: Props["muzikler"] }) {
  const gruplar = [
    { etiket: "Kütüphane", liste: muzikler.filter((m) => m.kutuphane) },
    { etiket: "Şirketinizin yüklediği", liste: muzikler.filter((m) => !m.kutuphane) },
  ].filter((g) => g.liste.length);
  return gruplar.map((g) => (
    <NativeSelectOptGroup key={g.etiket} label={g.etiket}>
      {g.liste.map((m) => (
        <NativeSelectOption key={m.id} value={m.id}>
          {m.ad}
        </NativeSelectOption>
      ))}
    </NativeSelectOptGroup>
  ));
}

/** Tema ve vurgu rengi birlikte değerlendirilir: renk her temada ayrı kontrol edilir, okunmadığı tema işaretlenir. */
function GorunumAlanlari({ d, h }: { d: FormAlanlari; h: Record<string, string> }) {
  const [tema, setTema] = useState<TemaAdi>((d.tema as TemaAdi | undefined) ?? "koyu");
  const [kendiRengi, setKendiRengi] = useState(d.vurguKendi === "on");
  const [renk, setRenk] = useState(d.vurguRengi || "#F2A541");
  const gecerliRenk = kendiRengi && VURGU_DESENI.test(renk) ? renk.toUpperCase() : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tema ve vurgu rengi</CardTitle>
        <CardDescription>Şirketinizin videoları bu temayla üretilir; her ilanda başka bir tema seçilebilir. Logo ve vurgu rengi her temada kullanılır.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <legend className="sr-only">Varsayılan tema</legend>
          {TEMA_ADLARI.map((ad) => {
            const t = TEMALAR[ad];
            const hata = vurguHatasi(gecerliRenk, ad);
            return (
              <label
                key={ad}
                className={cn(
                  "flex cursor-pointer flex-col gap-2 rounded-xl border bg-background p-2 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
                  tema === ad && "border-primary ring-2 ring-primary",
                )}
              >
                <input type="radio" name="tema" value={ad} checked={tema === ad} onChange={() => setTema(ad)} className="sr-only" />
                {/* Önizleme görselleri: npm run tema:onizleme (ÖRNEK görselli kurgusal ilan, temanın kendi rengiyle). */}
                <img src={`/temalar/${ad}.jpg`} alt={`${t.ad} tema örneği: bir sahne ve kapanış kartı`} className="aspect-[548/480] w-full rounded-lg object-cover" />
                <span className="flex items-center justify-between gap-2 px-1">
                  <span>
                    <span className="block font-medium">{t.ad}</span>
                    <span className="block text-xs text-muted-foreground">{t.aciklama}</span>
                  </span>
                  {gecerliRenk ? (
                    hata ? (
                      <TriangleAlert className="size-5 shrink-0 text-amber-600" aria-label="Vurgu rengi bu temada okunmuyor" />
                    ) : (
                      <CircleCheck className="size-5 shrink-0 text-green-600" aria-label="Vurgu rengi bu temada okunuyor" />
                    )
                  ) : null}
                </span>
              </label>
            );
          })}
        </fieldset>
        {h.tema ? <p className="text-sm text-destructive">{h.tema}</p> : null}

        <FormSatiri etiket="Vurgu rengi">
          <p className="text-xs text-muted-foreground">Fiyat, çizgiler ve altyazı kenarı bu renkte olur. Fiyat okunabilsin diye renk her temanın zeminine göre kontrol edilir.</p>
          <div className="flex min-h-8 flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <label className="flex items-center gap-2">
              <input type="radio" checked={!kendiRengi} onChange={() => setKendiRengi(false)} className="size-4 accent-primary" />
              Temanın kendi rengi
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" checked={kendiRengi} onChange={() => setKendiRengi(true)} className="size-4 accent-primary" />
              Şirketin rengi
            </label>
            <input type="hidden" name="vurguKendi" value={kendiRengi ? "on" : ""} />
            {kendiRengi ? (
              <span className="flex items-center gap-2">
                <input type="color" value={VURGU_DESENI.test(renk) ? renk : "#F2A541"} onChange={(e) => setRenk(e.target.value.toUpperCase())} className="h-8 w-12 cursor-pointer rounded border" aria-label="Renk seç" />
                <Input name="vurguRengi" value={renk} onChange={(e) => setRenk(e.target.value.trim())} className="w-28 font-mono" aria-label="Renk kodu" aria-invalid={Boolean(h.vurguRengi)} />
              </span>
            ) : null}
          </div>
          {h.vurguRengi ? <p className="text-sm text-destructive">{h.vurguRengi}</p> : null}
          {gecerliRenk ? (
            <ul className="flex flex-col gap-1 text-sm">
              {TEMA_ADLARI.map((ad) => {
                const hata = vurguHatasi(gecerliRenk, ad);
                return (
                  <li key={ad} className={hata ? "text-amber-800" : "text-muted-foreground"}>
                    {TEMALAR[ad].ad}: {hata ?? "okunuyor"}
                    {hata && ad === tema ? " Varsayılan tema bu olduğu için kaydedilemez." : hata ? " Bu temayı seçen ilanlarda video üretilmez." : ""}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </FormSatiri>
      </CardContent>
    </Card>
  );
}

function Metin({
  ad,
  etiket,
  d,
  h,
  tur = "text",
  yerTutucu,
  sayisal,
}: {
  ad: string;
  etiket: string;
  d: FormAlanlari;
  h: Record<string, string>;
  tur?: "text" | "tel" | "email";
  yerTutucu?: string;
  sayisal?: boolean;
}) {
  return (
    <FormSatiri ad={ad} etiket={etiket} hata={h[ad]}>
      <Input id={ad} name={ad} type={tur} defaultValue={d[ad] ?? ""} placeholder={yerTutucu} inputMode={sayisal ? "numeric" : undefined} aria-invalid={Boolean(h[ad])} />
    </FormSatiri>
  );
}
