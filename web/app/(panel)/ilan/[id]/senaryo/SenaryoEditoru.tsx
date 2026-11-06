"use client";

import { useMemo, useState, useTransition } from "react";
import {
  BASLIK_EN_FAZLA_KARAKTER,
  EKRAN_METNI_EN_FAZLA_KARAKTER,
  KELIME_SINIRI,
  kelimeSayisi,
  senaryoyuDogrula,
} from "@cekirdek/pipeline/senaryoDogrulama.js";
import { YER_TUTUCU_DESENI, yerTutucuTablosu } from "@cekirdek/pipeline/yerTutucu.js";
import type { Ilan } from "@cekirdek/schema/ilan.js";
import type { YzSenaryo } from "@cekirdek/schema/senaryo.js";
import { FOTOGRAF_TURU_ADLARI, fotografTuruMu } from "@cekirdek/veri/ilanFormu.js";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormSatiri } from "@/components/FormSatiri";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { senaryoKaydet } from "../../eylemler";
import { UretimButonu } from "../UretimButonu";

type Props = {
  ilanId: string;
  ilan: Ilan;
  senaryo: YzSenaryo;
  fotograflar: { dosyaAdi: string; tur: string; adres: string }[];
  /** Üretim sürerken düzenleme kapalı. */
  kilitli: boolean;
};

type Alan = "baslik" | "disSes" | "ekranMetni";

export function SenaryoEditoru({ ilanId, ilan, senaryo, fotograflar, kilitli }: Props) {
  const [taslak, setTaslak] = useState<YzSenaryo>(senaryo);
  const [sunucuHatalari, setSunucuHatalari] = useState<string[]>([]);
  const [bekliyor, gecis] = useTransition();

  const tablo = useMemo(() => yerTutucuTablosu(ilan), [ilan]);
  const kontrol = useMemo(() => senaryoyuDogrula(taslak, { ilan, tablo }), [taslak, ilan, tablo]);
  const degisti = JSON.stringify(taslak) !== JSON.stringify(senaryo);
  const toplamKelime = taslak.sahneler.reduce((t, s) => t + kelimeSayisi(s.disSes), 0);
  const fotoNo = new Map(fotograflar.map((f, i) => [f.dosyaAdi, i + 1]));

  /** Önizleme: yer tutucuları değerleriyle gösterir; bilinmeyeni olduğu gibi bırakır (hata listesinde zaten var). */
  const doldur = (metin: string, hedef: "ekran" | "ses") =>
    metin.replace(YER_TUTUCU_DESENI, (tam, ad: string) => tablo[ad as keyof typeof tablo]?.[hedef] ?? tam);

  function guncelle(sira: number, alan: Alan | "fotograf", deger: string) {
    setTaslak((t) => ({ sahneler: t.sahneler.map((s, i) => (i === sira ? { ...s, [alan]: deger } : s)) }));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border bg-background p-4 text-sm">
        <p className="font-medium">Kritik bilgiler kod tarafından yazılır</p>
        <p className="text-muted-foreground">
          Fiyat, telefon, metrekare ve konumu elle yazmayın; aşağıdaki işaretleri kullanın. Rakam, abartılı ifade ("fırsat", "en iyi") ve ilanda olmayan bilgi kabul
          edilmez.
        </p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {Object.entries(tablo).map(([ad, d]) => (
            <li key={ad} className="rounded-md bg-muted px-2 py-1">
              <code>{`{{${ad}}}`}</code> → {d.ekran}
            </li>
          ))}
        </ul>
      </div>

      <ol className="flex flex-col gap-4">
        {taslak.sahneler.map((s, sira) => {
          const foto = fotograflar.find((f) => f.dosyaAdi === s.fotograf);
          return (
            <li key={sira} className="grid gap-4 rounded-xl border bg-background p-4 sm:grid-cols-[160px_1fr]">
              <div className="flex flex-col gap-2">
                <div className="aspect-9/16 overflow-hidden rounded-lg bg-muted">
                  {foto ? <img src={foto.adres} alt="" className="size-full object-cover" /> : null}
                </div>
                <NativeSelect
                  aria-label={`${sira + 1}. sahnenin fotoğrafı`}
                  value={s.fotograf}
                  disabled={kilitli}
                  onChange={(e) => guncelle(sira, "fotograf", e.target.value)}
                  className="w-full"
                >
                  {fotograflar.map((f) => (
                    <NativeSelectOption key={f.dosyaAdi} value={f.dosyaAdi}>
                      {fotoNo.get(f.dosyaAdi)}. {fotografTuruMu(f.tur) ? FOTOGRAF_TURU_ADLARI[f.tur] : f.tur}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
              <div className="flex flex-col gap-3">
                <p className="text-sm font-medium text-muted-foreground">{sira + 1}. sahne</p>
                <MetinAlani
                  id={`s${sira}-baslik`}
                  etiket="Başlık (ekranda büyük)"
                  deger={s.baslik}
                  sinir={BASLIK_EN_FAZLA_KARAKTER}
                  onizleme={doldur(s.baslik, "ekran")}
                  kilitli={kilitli}
                  degistir={(d) => guncelle(sira, "baslik", d)}
                />
                <FormSatiri ad={`s${sira}-disSes`} etiket="Dış ses (okunacak metin)" aciklama={`${kelimeSayisi(s.disSes)} kelime · Okunuşu: ${doldur(s.disSes, "ses")}`}>
                  <Textarea id={`s${sira}-disSes`} rows={3} value={s.disSes} disabled={kilitli} onChange={(e) => guncelle(sira, "disSes", e.target.value)} />
                </FormSatiri>
                <MetinAlani
                  id={`s${sira}-ekranMetni`}
                  etiket="Ekran metni (altta sabit)"
                  deger={s.ekranMetni}
                  sinir={EKRAN_METNI_EN_FAZLA_KARAKTER}
                  onizleme={doldur(s.ekranMetni, "ekran")}
                  kilitli={kilitli}
                  degistir={(d) => guncelle(sira, "ekranMetni", d)}
                />
              </div>
            </li>
          );
        })}
      </ol>

      <div className="sticky bottom-0 flex flex-col gap-3 rounded-xl border bg-background p-4 shadow-sm">
        <p className={cn("text-sm", toplamKelime < KELIME_SINIRI.en_az || toplamKelime > KELIME_SINIRI.en_fazla ? "text-destructive" : "text-muted-foreground")}>
          Dış ses toplamı: {toplamKelime} kelime (olması gereken {KELIME_SINIRI.en_az}-{KELIME_SINIRI.en_fazla})
        </p>
        {kontrol.hatalar.length || sunucuHatalari.length ? (
          <Alert variant="destructive" aria-live="polite">
            <AlertDescription>
              <ul className="list-disc pl-4">
                {[...new Set([...kontrol.hatalar, ...sunucuHatalari])].map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        ) : null}
        <div className="flex flex-wrap items-start justify-end gap-2">
          {degisti ? (
            <>
              <Button variant="outline" size="lg" disabled={bekliyor} onClick={() => setTaslak(senaryo)}>
                Değişiklikleri geri al
              </Button>
              <Button
                size="lg"
                disabled={kilitli || bekliyor || kontrol.hatalar.length > 0}
                onClick={() => gecis(async () => setSunucuHatalari((await senaryoKaydet(ilanId, taslak)).hatalar))}
              >
                {bekliyor ? "Kaydediliyor…" : "Senaryoyu kaydet"}
              </Button>
            </>
          ) : (
            <>
              <UretimButonu
                ilanId={ilanId}
                tur="senaryo"
                zorla
                variant="outline"
                etiket="Yeni senaryo yazdır"
                onay="Yapay zekaya yeni bir senaryo yazdırılacak (küçük bir API ücreti olabilir). Elle yaptığınız düzenlemeler silinir. Devam edilsin mi?"
                disabled={kilitli}
              />
              <UretimButonu ilanId={ilanId} tur="video" etiket="Videoyu üret" disabled={kilitli || kontrol.hatalar.length > 0} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function MetinAlani(p: { id: string; etiket: string; deger: string; sinir: number; onizleme: string; kilitli: boolean; degistir: (d: string) => void }) {
  const uzunluk = [...p.onizleme].length;
  return (
    <FormSatiri ad={p.id} etiket={p.etiket}>
      <Input id={p.id} value={p.deger} disabled={p.kilitli} onChange={(e) => p.degistir(e.target.value)} aria-invalid={uzunluk > p.sinir} />
      <p className={cn("text-xs", uzunluk > p.sinir ? "text-destructive" : "text-muted-foreground")}>
        {uzunluk}/{p.sinir} karakter{p.onizleme !== p.deger ? ` · Videoda: ${p.onizleme}` : ""}
      </p>
    </FormSatiri>
  );
}
