import Link from "next/link";
import { cozunurlukUyarisi, EN_BUYUK_DOSYA_MB, EN_FAZLA_FOTOGRAF } from "@cekirdek/veri/fotografIsleme.js";
import { AdimCubugu } from "@/components/AdimCubugu";
import { buttonVariants } from "@/components/ui/button";
import { bulunamazsa404 } from "@/lib/hatalar";
import { girisGerekli } from "@/lib/oturum";
import { FotografYonetimi } from "./FotografYonetimi";

export default async function FotograflarSayfasi({ params }: PageProps<"/ilan/[id]/fotograflar">) {
  const { id } = await params;
  const { depo } = await girisGerekli();
  const [ilan, fotograflar] = await bulunamazsa404(Promise.all([depo.ilan(id), depo.fotograflar(id)]));
  const kartlar = await Promise.all(
    fotograflar.map(async (f) => ({ id: f.id, tur: f.tur, adres: await depo.dosyaBaglantisi(f.anahtar), uyari: cozunurlukUyarisi(f.genislik, f.yukseklik) })),
  );

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Fotoğraflar</h1>
      <AdimCubugu ilanId={id} etkin="fotograflar" />
      <p className="text-sm text-muted-foreground">
        Her fotoğrafın türünü seçin; sahneler fotoğrafın türüne göre eşleştirilir. Fotoğraflar küçültülür ve konum gibi gizli bilgileri silinerek saklanır.
      </p>
      {ilan.durum === "uretiliyor" ? (
        <p className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-blue-900">Video üretiliyor. Bitene kadar fotoğraflar değiştirilemez.</p>
      ) : null}
      <FotografYonetimi ilanId={id} fotograflar={kartlar} enFazla={EN_FAZLA_FOTOGRAF} enBuyukMb={EN_BUYUK_DOSYA_MB} kilitli={ilan.durum === "uretiliyor"} />
      <div className="flex justify-end">
        <Link href={`/ilan/${id}`} className={buttonVariants({ size: "lg", variant: fotograflar.length ? "default" : "outline" })}>
          {fotograflar.length ? "Devam et" : "Daha sonra yükle"}
        </Link>
      </div>
    </div>
  );
}
