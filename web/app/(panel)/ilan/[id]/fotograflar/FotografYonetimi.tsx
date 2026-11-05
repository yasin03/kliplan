"use client";

import { ArrowLeft, ArrowRight, ImagePlus, Trash2, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { FOTOGRAF_TURU_ADLARI } from "@cekirdek/veri/ilanFormu.js";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import { type EylemSonucu, fotograflariSirala, fotografSil, fotografTuruDegistir } from "../../eylemler";

export type FotografKarti = { id: string; adres: string; tur: string; uyari: string | null };

type Props = {
  ilanId: string;
  fotograflar: FotografKarti[];
  enFazla: number;
  enBuyukMb: number;
  /** Üretim sürerken değişiklik kapalı. */
  kilitli: boolean;
};

const KABUL = "image/jpeg,image/png,image/webp";

export function FotografYonetimi({ ilanId, fotograflar, enFazla, enBuyukMb, kilitli }: Props) {
  const router = useRouter();
  const girdi = useRef<HTMLInputElement>(null);
  const [surukleniyor, setSurukleniyor] = useState(false);
  const [yukleme, setYukleme] = useState<{ sira: number; toplam: number } | null>(null);
  const [hatalar, setHatalar] = useState<string[]>([]);
  const [bekliyor, gecis] = useTransition();
  const mesgul = kilitli || bekliyor || yukleme !== null;

  async function yukle(dosyalar: File[]) {
    if (mesgul || dosyalar.length === 0) return;
    const yeniHatalar: string[] = [];
    const yer = enFazla - fotograflar.length;
    if (dosyalar.length > yer) {
      yeniHatalar.push(`En fazla ${enFazla} fotoğraf eklenebilir; ilk ${Math.max(yer, 0)} tanesi yükleniyor.`);
      dosyalar = dosyalar.slice(0, Math.max(yer, 0));
    }
    // Sunucu da kontrol ediyor; burada büyük dosyayı boşuna göndermemek için.
    const uygun = dosyalar.filter((d) => {
      if (d.size <= enBuyukMb * 1024 * 1024) return true;
      yeniHatalar.push(`${d.name}: ${enBuyukMb} MB'tan büyük.`);
      return false;
    });

    // Sırayla yüklenir: fotoğraflar seçildiği sırada listeye eklenir ve sunucu tek seferde bir dosya işler.
    for (const [i, dosya] of uygun.entries()) {
      setYukleme({ sira: i + 1, toplam: uygun.length });
      const form = new FormData();
      form.set("dosya", dosya);
      form.set("tur", "diger");
      try {
        const yanit = await fetch(`/api/ilan/${ilanId}/fotograf`, { method: "POST", body: form });
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

  function calistir(is: () => Promise<EylemSonucu>) {
    gecis(async () => {
      const { hata } = await is();
      setHatalar(hata ? [hata] : []);
    });
  }

  function tasi(sira: number, yon: -1 | 1) {
    const yeni = fotograflar.map((f) => f.id);
    [yeni[sira], yeni[sira + yon]] = [yeni[sira + yon]!, yeni[sira]!];
    calistir(() => fotograflariSirala(ilanId, yeni));
  }

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        disabled={mesgul || fotograflar.length >= enFazla}
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
          "flex flex-col items-center gap-2 rounded-xl border-2 border-dashed bg-background px-4 py-10 text-center transition-colors",
          "hover:border-primary/50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60",
          surukleniyor && "border-primary bg-primary/5",
        )}
      >
        <ImagePlus className="size-8 text-muted-foreground" aria-hidden />
        <span className="font-medium">
          {yukleme ? `Yükleniyor… (${yukleme.sira}/${yukleme.toplam})` : "Fotoğrafları buraya sürükleyin veya seçmek için tıklayın"}
        </span>
        <span className="text-sm text-muted-foreground">
          JPEG, PNG veya WebP · en fazla {enBuyukMb} MB · {fotograflar.length}/{enFazla} fotoğraf
        </span>
      </button>
      <input
        ref={girdi}
        type="file"
        accept={KABUL}
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

      {fotograflar.length ? (
        <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {fotograflar.map((f, sira) => (
            <li key={f.id} className="flex flex-col overflow-hidden rounded-xl border bg-background">
              <div className="relative aspect-4/3 bg-muted">
                {/* İmzalı bağlantı 10 dk geçerli; next/image önbelleği bu bağlantılarla çalışmaz. */}
                <img src={f.adres} alt={`${sira + 1}. fotoğraf`} className="size-full object-cover" loading="lazy" />
                <span className="absolute top-2 left-2 rounded-md bg-black/70 px-2 py-0.5 text-sm font-medium text-white">
                  {sira + 1}
                </span>
              </div>
              <div className="flex flex-col gap-2 p-3">
                <NativeSelect
                  aria-label={`${sira + 1}. fotoğrafın türü`}
                  value={f.tur}
                  disabled={mesgul}
                  onChange={(e) => calistir(() => fotografTuruDegistir(f.id, e.target.value))}
                  className="w-full"
                >
                  {Object.entries(FOTOGRAF_TURU_ADLARI).map(([deger, ad]) => (
                    <NativeSelectOption key={deger} value={deger}>
                      {ad}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                {f.uyari ? (
                  <p className="flex gap-1.5 text-xs text-amber-700">
                    <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
                    {f.uyari}
                  </p>
                ) : null}
                <div className="flex items-center justify-between">
                  <div className="flex gap-1">
                    <Button variant="outline" size="icon-sm" aria-label="Öne al" disabled={mesgul || sira === 0} onClick={() => tasi(sira, -1)}>
                      <ArrowLeft />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      aria-label="Arkaya al"
                      disabled={mesgul || sira === fotograflar.length - 1}
                      onClick={() => tasi(sira, 1)}
                    >
                      <ArrowRight />
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={mesgul}
                    onClick={() => {
                      if (confirm(`${sira + 1}. fotoğraf silinsin mi?`)) calistir(() => fotografSil(f.id));
                    }}
                  >
                    <Trash2 /> Sil
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
