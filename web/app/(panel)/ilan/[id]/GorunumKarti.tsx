"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { TEMA_ADLARI, type TemaAdi, TEMALAR } from "@cekirdek/remotion/temalar.js";
import { FormSatiri } from "@/components/FormSatiri";
import { GosterilenSecim } from "@/components/GosterilenSecim";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { GorunumSecenekleri } from "@/lib/gorunumSecenekleri";
import { MuzikSecenekleri } from "../../ayarlar/AyarlarFormu";
import { ilanGorunumuKaydet } from "../eylemler";

type Props = {
  ilanId: string;
  tema: TemaAdi | null;
  /** Kayıttaki seçimlerin form değerleri (`secimDegeri`): "" şirket varsayılanı, "yok", veya kimlik. */
  muzik: string;
  resim: string;
  logo: string;
  secenekler: GorunumSecenekleri;
  /** Şirketin vurgu renginin okunmadığı temalar ve nedeni. */
  okunmayanTemalar: Partial<Record<TemaAdi, string>>;
  kilitli: boolean;
  /** Ayarlar bağlantısı (admin için şirket seçili). */
  ayarlarAdresi: string;
};

/** Form değeri → kayıttaki seçim. */
const secim = (deger: string) => (deger === "" ? { secim: "ofis" as const, id: null } : deger === "yok" ? { secim: "yok" as const, id: null } : { secim: "secili" as const, id: deger });

export function GorunumKarti(p: Props) {
  const [tema, setTema] = useState(p.tema ?? "");
  const [muzik, setMuzik] = useState(p.muzik);
  const [resim, setResim] = useState(p.resim);
  const [logo, setLogo] = useState(p.logo);
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, gecis] = useTransition();
  const degisti = tema !== (p.tema ?? "") || muzik !== p.muzik || resim !== p.resim || logo !== p.logo;
  const etkinTema = (tema || p.secenekler.ofisTemasi) as TemaAdi;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Logo, görünüm ve müzik</CardTitle>
        <CardDescription>
          Logo ve resim yükleme, vurgu rengi ve varsayılanlar <Link href={p.ayarlarAdresi} className="underline">şirket ayarlarında</Link>. Değiştirirseniz senaryo
          korunur, video yeniden üretilmelidir.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <FormSatiri ad="ilan-tema" etiket="Tema" hata={p.okunmayanTemalar[etkinTema]}>
          <NativeSelect id="ilan-tema" value={tema} onChange={(e) => setTema(e.target.value)} disabled={p.kilitli} className="w-full">
            <NativeSelectOption value="">Şirket varsayılanı ({p.secenekler.ofisTemaAdi})</NativeSelectOption>
            {TEMA_ADLARI.map((ad) => (
              <NativeSelectOption key={ad} value={ad}>
                {TEMALAR[ad].ad}
                {p.okunmayanTemalar[ad] ? " (vurgu rengi okunmuyor)" : ""}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </FormSatiri>
        <FormSatiri ad="ilan-muzik" etiket="Müzik">
          <NativeSelect id="ilan-muzik" value={muzik} onChange={(e) => setMuzik(e.target.value)} disabled={p.kilitli} className="w-full">
            <NativeSelectOption value="">Şirket varsayılanı ({p.secenekler.ofisMuzigi ?? "müziksiz"})</NativeSelectOption>
            <NativeSelectOption value="yok">Müziksiz</NativeSelectOption>
            <MuzikSecenekleri muzikler={p.secenekler.muzikler} />
          </NativeSelect>
        </FormSatiri>
        <GosterilenSecim
          ad="ilan-logo"
          etiket="Logo"
          aciklama="Kapalıysa videoda yalnızca şirket adı yazar."
          secenekler={p.secenekler.ilanLogoSecenekleri}
          deger={logo}
          onDegistir={setLogo}
          bicim="logo"
          devreDisi={p.kilitli}
        />
        <GosterilenSecim
          ad="ilan-resim"
          etiket="Kapanış arka planı"
          aciklama="Kapalıysa son sahnede ilan fotoğrafı görünür."
          secenekler={p.secenekler.ilanResimSecenekleri}
          deger={resim}
          onDegistir={setResim}
          devreDisi={p.kilitli}
        />
        {hata ? <p className="text-sm text-destructive">{hata}</p> : null}
        {degisti ? (
          <div className="flex justify-end">
            <Button
              disabled={bekliyor || p.kilitli}
              onClick={() =>
                gecis(async () => {
                  const m = secim(muzik);
                  const r = secim(resim);
                  const l = secim(logo);
                  setHata(
                    (
                      await ilanGorunumuKaydet(p.ilanId, {
                        tema: (tema || null) as TemaAdi | null,
                        muzikSecimi: m.secim,
                        muzikId: m.id,
                        resimSecimi: r.secim,
                        resimId: r.id,
                        logoSecimi: l.secim,
                        logoId: l.id,
                      })
                    ).hata,
                  );
                })
              }
            >
              {bekliyor ? "Kaydediliyor…" : "Kaydet"}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
