"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormSatiri } from "@/components/FormSatiri";

type Props = {
  /** Admin hazır kütüphaneye ekler; üye kendi ofisine, beyanla. */
  kutuphane: boolean;
  enBuyukMb: number;
  beyanMetni: string;
};

export function MuzikYukleme({ kutuphane, enBuyukMb, beyanMetni }: Props) {
  const router = useRouter();
  const [bekliyor, setBekliyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [tamam, setTamam] = useState(false);

  async function gonder(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const dosya = form.get("dosya");
    if (!(dosya instanceof File) || dosya.size === 0) return setHata("Bir müzik dosyası seçin.");
    // Sunucu da kontrol ediyor; burada büyük dosyayı boşuna göndermemek için.
    if (dosya.size > enBuyukMb * 1024 * 1024) return setHata(`Dosya ${enBuyukMb} MB'tan büyük.`);
    if (kutuphane) form.set("kutuphane", "on");
    setBekliyor(true);
    setHata(null);
    setTamam(false);
    try {
      const yanit = await fetch("/api/muzik", { method: "POST", body: form });
      if (!yanit.ok) {
        const govde = (await yanit.json().catch(() => null)) as { hata?: string } | null;
        setHata(govde?.hata ?? "Yüklenemedi. Tekrar deneyin.");
      } else {
        formEl.reset();
        setTamam(true);
        router.refresh();
      }
    } catch {
      setHata("Bağlantı hatası. İnternetinizi kontrol edip tekrar deneyin.");
    }
    setBekliyor(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{kutuphane ? "Kütüphaneye müzik ekle" : "Kendi müziğinizi yükleyin"}</CardTitle>
        <CardDescription>
          {kutuphane
            ? "Bütün şirketler görür ve kullanabilir. Lisansın ticari kullanımı ve müşteri videolarını kapsadığından emin olun; lisans bilgisi her videonun raporuna yazılır."
            : "Yalnızca ticari kullanım izniniz olan müziği yükleyin (ör. satın aldığınız lisanslı müzik). Radyodan, YouTube'dan veya bir şarkıdan alınan müzik kullanılamaz."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={gonder} className="flex flex-col gap-4" noValidate>
          <FormSatiri ad="muzik-dosya" etiket="Dosya" aciklama={`MP3, M4A veya WAV · en fazla ${enBuyukMb} MB · 5 sn - 10 dk`}>
            <Input id="muzik-dosya" name="dosya" type="file" accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,.mp3,.m4a,.wav" />
          </FormSatiri>
          <FormSatiri ad="muzik-ad" etiket="Ad">
            <Input id="muzik-ad" name="ad" maxLength={80} placeholder="ör. Sakin piyano" />
          </FormSatiri>
          <FormSatiri ad="muzik-lisans" etiket="Lisans bilgisi" aciklama="İznin nereden geldiği; kontrol raporuna aynen yazılır.">
            <Input id="muzik-lisans" name="lisans" maxLength={500} placeholder="ör. Artlist kişisel lisans, sipariş no 12345 veya satın alma bağlantısı" />
          </FormSatiri>
          {kutuphane ? null : (
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="beyan" className="mt-0.5 size-4 shrink-0 accent-primary" />
              <span>{beyanMetni}</span>
            </label>
          )}
          {hata ? (
            <Alert variant="destructive" aria-live="polite">
              <AlertDescription>{hata}</AlertDescription>
            </Alert>
          ) : null}
          <div className="flex items-center justify-end gap-3">
            {tamam ? (
              <span className="text-sm text-green-700" aria-live="polite">
                Yüklendi.
              </span>
            ) : null}
            <Button type="submit" disabled={bekliyor}>
              {bekliyor ? "Yükleniyor…" : "Yükle"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
