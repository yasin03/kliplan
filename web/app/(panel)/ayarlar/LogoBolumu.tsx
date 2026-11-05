"use client";

import { ImagePlus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { logoSil } from "./eylemler";

type Props = {
  /** Yalnızca admin için; üye kendi ofisini düzenler. */
  ofisId: string | null;
  /** Mevcut logonun kısa ömürlü bağlantısı. */
  adres: string | null;
};

export function LogoBolumu({ ofisId, adres }: Props) {
  const router = useRouter();
  const girdi = useRef<HTMLInputElement>(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [uyarilar, setUyarilar] = useState<string[]>([]);
  const [bekliyor, gecis] = useTransition();
  const mesgul = yukleniyor || bekliyor;

  async function yukle(dosya: File) {
    setYukleniyor(true);
    setHata(null);
    setUyarilar([]);
    const form = new FormData();
    form.set("dosya", dosya);
    if (ofisId) form.set("ofisId", ofisId);
    try {
      const yanit = await fetch("/api/ofis/logo", { method: "POST", body: form });
      const govde = (await yanit.json().catch(() => null)) as { hata?: string; uyarilar?: string[] } | null;
      if (!yanit.ok) setHata(govde?.hata ?? "Yüklenemedi. Tekrar deneyin.");
      else setUyarilar(govde?.uyarilar ?? []);
    } catch {
      setHata("Bağlantı hatası. İnternetinizi kontrol edip tekrar deneyin.");
    }
    setYukleniyor(false);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Logo</CardTitle>
        <CardDescription>
          Videonun üst köşesinde ve kapanış kartında şirket adının yanında görünür. Saydam zeminli PNG önerilir. Logo yoksa yalnızca şirket adı gösterilir.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-4">
          {adres ? (
            // Koyu ve açık temada nasıl göründüğü: iki zeminde yan yana.
            <div className="flex gap-2">
              {["bg-[#0B1F3A]", "bg-white border"].map((zemin) => (
                <div key={zemin} className={`flex h-20 w-40 items-center justify-center rounded-lg p-3 ${zemin}`}>
                  <img src={adres} alt="Şirket logosu" className="max-h-full max-w-full object-contain" />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Henüz logo yüklenmedi.</p>
          )}
          <div className="flex gap-2">
            <Button variant="outline" disabled={mesgul} onClick={() => girdi.current?.click()}>
              <ImagePlus /> {yukleniyor ? "Yükleniyor…" : adres ? "Logoyu değiştir" : "Logo yükle"}
            </Button>
            {adres ? (
              <Button
                variant="ghost"
                disabled={mesgul}
                onClick={() => {
                  if (!confirm("Logo silinsin mi? Bundan sonraki videolarda yalnızca şirket adı görünür.")) return;
                  gecis(async () => setHata((await logoSil(ofisId)).hata));
                }}
              >
                <Trash2 /> Sil
              </Button>
            ) : null}
          </div>
        </div>
        <input
          ref={girdi}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
          onChange={(e) => {
            const dosya = e.target.files?.[0];
            if (dosya) void yukle(dosya);
            e.target.value = "";
          }}
        />
        <p className="text-xs text-muted-foreground">PNG, JPEG veya WebP · en fazla 5 MB. SVG desteklenmez.</p>
        {hata ? (
          <Alert variant="destructive" aria-live="polite">
            <AlertDescription>{hata}</AlertDescription>
          </Alert>
        ) : null}
        {uyarilar.length ? (
          <ul className="list-disc pl-5 text-sm text-amber-800" aria-live="polite">
            {uyarilar.map((u) => (
              <li key={u}>{u}</li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
