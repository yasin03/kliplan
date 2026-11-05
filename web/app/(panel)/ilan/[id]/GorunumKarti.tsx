"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { TEMA_ADLARI, type TemaAdi, TEMALAR } from "@cekirdek/remotion/temalar.js";
import { ResimSecici } from "@/components/ResimSecici";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
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
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, gecis] = useTransition();
  const degisti = tema !== (p.tema ?? "") || muzik !== p.muzik || resim !== p.resim;
  const etkinTema = (tema || p.secenekler.ofisTemasi) as TemaAdi;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Görünüm ve müzik</CardTitle>
        <CardDescription>
          Logo, vurgu rengi, şirket resimleri ve varsayılanlar <Link href={p.ayarlarAdresi} className="underline">şirket ayarlarında</Link>. Değiştirirseniz senaryo
          korunur, video yeniden üretilmelidir.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ilan-tema">Tema</Label>
            <NativeSelect id="ilan-tema" value={tema} onChange={(e) => setTema(e.target.value)} disabled={p.kilitli} className="w-full">
              <NativeSelectOption value="">Şirket varsayılanı ({p.secenekler.ofisTemaAdi})</NativeSelectOption>
              {TEMA_ADLARI.map((ad) => (
                <NativeSelectOption key={ad} value={ad}>
                  {TEMALAR[ad].ad}
                  {p.okunmayanTemalar[ad] ? " (vurgu rengi okunmuyor)" : ""}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            {p.okunmayanTemalar[etkinTema] ? <p className="text-sm text-destructive">{p.okunmayanTemalar[etkinTema]}</p> : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ilan-muzik">Müzik</Label>
            <NativeSelect id="ilan-muzik" value={muzik} onChange={(e) => setMuzik(e.target.value)} disabled={p.kilitli} className="w-full">
              <NativeSelectOption value="">Şirket varsayılanı ({p.secenekler.ofisMuzigi ?? "müziksiz"})</NativeSelectOption>
              <NativeSelectOption value="yok">Müziksiz</NativeSelectOption>
              <MuzikSecenekleri muzikler={p.secenekler.muzikler} />
            </NativeSelect>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Kapanış arka planı</Label>
          <ResimSecici ad="ilan-resim" secenekler={p.secenekler.ilanResimSecenekleri} deger={resim} onDegistir={setResim} devreDisi={p.kilitli} />
        </div>
        {hata ? <p className="text-sm text-destructive">{hata}</p> : null}
        {degisti ? (
          <div className="flex justify-end">
            <Button
              disabled={bekliyor || p.kilitli}
              onClick={() =>
                gecis(async () => {
                  const m = secim(muzik);
                  const r = secim(resim);
                  setHata(
                    (await ilanGorunumuKaydet(p.ilanId, { tema: (tema || null) as TemaAdi | null, muzikSecimi: m.secim, muzikId: m.id, resimSecimi: r.secim, resimId: r.id })).hata,
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
