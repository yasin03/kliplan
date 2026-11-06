"use client";

import { ImagePlus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import type { ResimSecenegi } from "@/components/ResimSecici";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { logoSil } from "./eylemler";

type Props = {
  /** Yalnızca admin için; üye kendi ofisini düzenler. */
  ofisId: string | null;
  /** Logolar, kısa ömürlü bağlantılarıyla. */
  logolar: ResimSecenegi[];
  enFazla: number;
};

/** Şirketin logoları. Varsayılan logo aşağıdaki formda, ilanın logosu ilan bilgilerinde seçilir. */
export function LogoBolumu({ ofisId, logolar, enFazla }: Props) {
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
        <CardTitle>Logolar</CardTitle>
        <CardDescription>
          Videonun üst köşesinde ve kapanış kartında şirket adının yanında görünür. Birden fazla logo yükleyip her ilanda birini seçebilirsiniz. Saydam zeminli PNG önerilir.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {logolar.length ? (
          <ul className="flex flex-col gap-3">
            {logolar.map((l) => (
              <li key={l.deger} className="flex flex-wrap items-center gap-3">
                <span className="w-14 text-sm">{l.etiket}</span>
                {/* Koyu ve açık temada nasıl göründüğü: iki zeminde yan yana. */}
                <div className="flex gap-2">
                  {["bg-[#0B1F3A]", "bg-white border"].map((zemin) => (
                    <div key={zemin} className={`flex h-16 w-32 items-center justify-center rounded-lg p-2 ${zemin}`}>
                      <img src={l.adres ?? ""} alt={l.etiket} className="max-h-full max-w-full object-contain" />
                    </div>
                  ))}
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={mesgul}
                  aria-label={`${l.etiket} sil`}
                  onClick={() => {
                    if (!confirm(`${l.etiket} silinsin mi? Üretilmiş videolar etkilenmez; bu logoyu seçen ilanlar şirketin varsayılanına döner.`)) return;
                    gecis(async () => setHata((await logoSil(l.deger)).hata));
                  }}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Henüz logo yüklenmedi. Logo yoksa videoda yalnızca şirket adı gösterilir.</p>
        )}
        <div>
          <Button variant="outline" disabled={mesgul || logolar.length >= enFazla} onClick={() => girdi.current?.click()}>
            <ImagePlus /> {yukleniyor ? "Yükleniyor…" : "Logo ekle"}
          </Button>
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
        <p className="text-xs text-muted-foreground">
          PNG, JPEG veya WebP · en fazla 5 MB · {logolar.length}/{enFazla} logo. SVG desteklenmez.
        </p>
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
