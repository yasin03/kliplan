"use client";

import { ImagePlus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import type { ResimSecenegi } from "@/components/ResimSecici";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { resimSil } from "./eylemler";

type Props = {
  /** Yalnızca admin için; üye kendi şirketini düzenler. */
  ofisId: string | null;
  resimler: ResimSecenegi[];
  enFazla: number;
  enBuyukMb: number;
};

/** Şirketin resimleri (ör. ofis içi). İlanda seçilen resim videonun kapanış sahnesinde arka plan olur. */
export function ResimBolumu({ ofisId, resimler, enFazla, enBuyukMb }: Props) {
  const router = useRouter();
  const girdi = useRef<HTMLInputElement>(null);
  const [surukleniyor, setSurukleniyor] = useState(false);
  const [yukleme, setYukleme] = useState<{ sira: number; toplam: number } | null>(null);
  const [hatalar, setHatalar] = useState<string[]>([]);
  const [bekliyor, gecis] = useTransition();
  const mesgul = bekliyor || yukleme !== null;

  async function yukle(dosyalar: File[]) {
    if (mesgul || dosyalar.length === 0) return;
    const yeniHatalar: string[] = [];
    const yer = enFazla - resimler.length;
    if (dosyalar.length > yer) {
      yeniHatalar.push(`En fazla ${enFazla} resim yüklenebilir; ilk ${Math.max(yer, 0)} tanesi yükleniyor.`);
      dosyalar = dosyalar.slice(0, Math.max(yer, 0));
    }
    const uygun = dosyalar.filter((d) => {
      if (d.size <= enBuyukMb * 1024 * 1024) return true;
      yeniHatalar.push(`${d.name}: ${enBuyukMb} MB'tan büyük.`);
      return false;
    });
    for (const [i, dosya] of uygun.entries()) {
      setYukleme({ sira: i + 1, toplam: uygun.length });
      const form = new FormData();
      form.set("dosya", dosya);
      if (ofisId) form.set("ofisId", ofisId);
      try {
        const yanit = await fetch("/api/sirket/resim", { method: "POST", body: form });
        if (!yanit.ok) {
          const govde = (await yanit.json().catch(() => null)) as { hata?: string } | null;
          yeniHatalar.push(`${dosya.name}: ${govde?.hata ?? "Yüklenemedi. Tekrar deneyin."}`);
        }
      } catch {
        yeniHatalar.push(`${dosya.name}: Bağlantı hatası. İnternetinizi kontrol edip tekrar deneyin.`);
      }
    }
    setYukleme(null);
    setHatalar(yeniHatalar);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Şirket resimleri</CardTitle>
        <CardDescription>
          Ofisinizin içi, dış cephesi veya ekibiniz. İlanda seçtiğiniz resim, videonun son sahnesinde (fiyat ve telefon kartının arkasında) görünür. Dikey resimler ekranı
          tam kaplar.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <button
          type="button"
          disabled={mesgul || resimler.length >= enFazla}
          onClick={() => girdi.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setSurukleniyor(true);
          }}
          onDragLeave={() => setSurukleniyor(false)}
          onDrop={(e) => {
            e.preventDefault();
            setSurukleniyor(false);
            void yukle([...e.dataTransfer.files]);
          }}
          className={cn(
            "flex flex-col items-center gap-2 rounded-xl border-2 border-dashed bg-background px-4 py-6 text-center transition-colors",
            "hover:border-primary/50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60",
            surukleniyor && "border-primary bg-primary/5",
          )}
        >
          <ImagePlus className="size-7 text-muted-foreground" aria-hidden />
          <span className="font-medium">{yukleme ? `Yükleniyor… (${yukleme.sira}/${yukleme.toplam})` : "Resimleri sürükleyin veya seçmek için tıklayın"}</span>
          <span className="text-sm text-muted-foreground">
            JPEG, PNG veya WebP · en fazla {enBuyukMb} MB · {resimler.length}/{enFazla} resim
          </span>
        </button>
        <input
          ref={girdi}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          hidden
          onChange={(e) => {
            void yukle([...(e.target.files ?? [])]);
            e.target.value = "";
          }}
        />
        {hatalar.length ? (
          <Alert variant="destructive" aria-live="polite">
            <AlertDescription>
              <ul className="list-disc pl-4">
                {hatalar.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        ) : null}
        {resimler.length ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {resimler.map((r) => (
              <li key={r.deger} className="flex flex-col gap-1.5">
                <img src={r.adres ?? ""} alt={r.etiket} className="aspect-[9/16] w-full rounded-lg border object-cover" loading="lazy" />
                <div className="flex items-center justify-between gap-1 text-xs">
                  <span>{r.etiket}</span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={mesgul}
                    aria-label={`${r.etiket} sil`}
                    onClick={() => {
                      if (!confirm(`${r.etiket} silinsin mi? Üretilmiş videolar etkilenmez; bu resmi seçen ilanlar şirketin varsayılanına döner.`)) return;
                      gecis(async () => {
                        const { hata } = await resimSil(r.deger);
                        setHatalar(hata ? [hata] : []);
                      });
                    }}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
