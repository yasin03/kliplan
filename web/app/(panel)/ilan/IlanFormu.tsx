"use client";

import Link from "next/link";
import { useActionState } from "react";
import { TEMA_ADLARI, TEMALAR } from "@cekirdek/remotion/temalar.js";
import { KULLANIM_DURUMLARI, type FormAlanlari } from "@cekirdek/veri/ilanFormu.js";
import { ResimSecici } from "@/components/ResimSecici";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { GorunumSecenekleri } from "@/lib/gorunumSecenekleri";
import { MuzikSecenekleri } from "../ayarlar/AyarlarFormu";
import { type FormDurumu, ilanKaydet } from "./eylemler";

type Props = {
  /** Boşsa yeni ilan. */
  ilanId: string | null;
  baslangic: FormAlanlari;
  ofisAdi: string | null;
  /** Yalnızca admin yeni ilan açarken: ilanın şirketi seçilir. */
  ofisler?: { id: string; ad: string }[];
  /** Tema, müzik ve kapanış resmi seçenekleri. Admin yeni ilan açarken şirket henüz belli olmadığı için verilmez. */
  gorunum?: GorunumSecenekleri;
};

export function IlanFormu({ ilanId, baslangic, ofisAdi, ofisler, gorunum }: Props) {
  const [durum, gonder, bekliyor] = useActionState<FormDurumu, FormData>(ilanKaydet.bind(null, ilanId), {
    hatalar: {},
    mesaj: null,
    degerler: baslangic,
  });
  const { degerler: d, hatalar: h } = durum;

  return (
    // Gönderimden sonra React formu sıfırlar; anahtar değişince alanlar dönen değerlerle yeniden kurulur.
    <form action={gonder} key={JSON.stringify(d)} className="flex flex-col gap-4" noValidate>
      {ofisler ? (
        <Bolum baslik="Şirket" aciklama="Yönetici olarak ilanı hangi şirket adına açtığınızı seçin. Tema, müzik ve kapanış resmi şirketin varsayılanlarıyla başlar; ilan sayfasından değiştirilebilir.">
          <Alan ad="ofisId" etiket="Şirket" hata={h.ofisId}>
            <NativeSelect id="ofisId" name="ofisId" defaultValue={d.ofisId ?? ""} className="w-full" aria-invalid={Boolean(h.ofisId)}>
              <NativeSelectOption value="">Seçin</NativeSelectOption>
              {ofisler.map((o) => (
                <NativeSelectOption key={o.id} value={o.id}>
                  {o.ad}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Alan>
        </Bolum>
      ) : null}

      <Bolum baslik="Daire" aciklama="İlandaki bilgileri olduğu gibi girin.">
        <Izgara>
          <MetinAlani ad="ilanNo" etiket="İlan numarası" d={d} h={h} sayisal aciklama="Sahibinden vb. ilan numarası" />
          <MetinAlani ad="odaSayisi" etiket="Oda sayısı" d={d} h={h} yerTutucu="2+1" liste="oda-sayilari" />
          <MetinAlani ad="brutM2" etiket="Brüt m²" d={d} h={h} sayisal />
          <MetinAlani ad="netM2" etiket="Net m²" d={d} h={h} sayisal />
          <MetinAlani ad="binaYasi" etiket="Bina yaşı" d={d} h={h} sayisal aciklama="Yeni binada 0" />
          <MetinAlani ad="bulunduguKat" etiket="Bulunduğu kat" d={d} h={h} sayisal aciklama="Zemin kat 0, bodrum -1" />
          <MetinAlani ad="katSayisi" etiket="Binadaki kat sayısı" d={d} h={h} sayisal />
        </Izgara>
        <datalist id="oda-sayilari">
          {["1+0", "1+1", "2+1", "3+1", "4+1", "5+1"].map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>
      </Bolum>

      <Bolum baslik="Fiyat ve konum" aciklama="Video üretmek için fiyat doğrulanmış olmalı. Konumu işaretlemezseniz videoda gösterilmez.">
        <Izgara>
          <MetinAlani ad="fiyatTl.deger" etiket="Fiyat (TL)" d={d} h={h} sayisal yerTutucu="4.500.000" />
          <OnayKutusu ad="fiyatTl.onayli" d={d} />
        </Izgara>
        <Izgara>
          <MetinAlani ad="konum.il" etiket="İl" d={d} h={h} />
          <MetinAlani ad="konum.ilce" etiket="İlçe" d={d} h={h} />
          <MetinAlani ad="konum.mahalle" etiket="Mahalle" d={d} h={h} />
          <OnayKutusu ad="konum.onayli" d={d} />
        </Izgara>
      </Bolum>

      <Bolum
        baslik="İletişim"
        aciklama={`Videonun sonunda gösterilir; video üretmek için ikisi de doğrulanmış olmalı.${ofisAdi ? ` Şirket adı: ${ofisAdi}.` : ""}`}
      >
        <Izgara>
          <MetinAlani ad="telefon.deger" etiket="Telefon" d={d} h={h} tur="tel" yerTutucu="0505 709 44 88" />
          <OnayKutusu ad="telefon.onayli" d={d} />
        </Izgara>
        <Izgara>
          <MetinAlani ad="yetkiBelgeNo.deger" etiket="Yetki belge numarası" d={d} h={h} sayisal />
          <OnayKutusu ad="yetkiBelgeNo.onayli" d={d} />
        </Izgara>
      </Bolum>

      <Bolum baslik="Özellikler" aciklama="Boş bıraktığınız alanlar videoda geçmez.">
        <Izgara>
          <MetinAlani ad="isitma" etiket="Isıtma" d={d} h={h} liste="isitma" />
          <MetinAlani ad="mutfak" etiket="Mutfak" d={d} h={h} liste="mutfak" />
          <MetinAlani ad="tapu" etiket="Tapu durumu" d={d} h={h} liste="tapu" />
          <EvetHayir ad="esyali" etiket="Eşyalı" d={d} />
          <EvetHayir ad="krediyeUygun" etiket="Krediye uygun" d={d} />
        </Izgara>
        <Alan ad="ozellikler" etiket="Diğer özellikler" aciklama="Her satıra bir özellik, ör. Cam balkon" hata={h.ozellikler}>
          <Textarea id="ozellikler" name="ozellikler" rows={5} defaultValue={d.ozellikler ?? ""} />
        </Alan>
        <Oneriler id="isitma" degerler={["Kombi (doğalgaz)", "Merkezi sistem", "Yerden ısıtma", "Klima", "Soba"]} />
        <Oneriler id="mutfak" degerler={["Kapalı mutfak", "Açık Amerikan mutfak"]} />
        <Oneriler id="tapu" degerler={["Kat mülkiyetli", "Kat irtifaklı", "Hisseli tapu", "Arsa tapulu"]} />
      </Bolum>

      <Bolum baslik="Kullanım durumu (isteğe bağlı)" aciklama="Kira bilgisi yalnızca doğruladıysanız videoda geçer.">
        <Izgara>
          <Alan ad="kiraDurumu.aciklama" etiket="Kullanım durumu" hata={h["kiraDurumu.aciklama"]}>
            <NativeSelect
              id="kiraDurumu.aciklama"
              name="kiraDurumu.aciklama"
              defaultValue={d["kiraDurumu.aciklama"] ?? ""}
              className="w-full"
              aria-invalid={Boolean(h["kiraDurumu.aciklama"])}
            >
              <NativeSelectOption value="">Belirtilmedi</NativeSelectOption>
              {[...new Set([...KULLANIM_DURUMLARI, d["kiraDurumu.aciklama"]])].filter(Boolean).map((o) => (
                <NativeSelectOption key={o} value={o}>
                  {o}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Alan>
          <MetinAlani ad="kiraDurumu.kiraTl" etiket="Aylık kira (TL)" d={d} h={h} sayisal />
          <OnayKutusu ad="kiraDurumu.onayli" d={d} />
        </Izgara>
        <Alan ad="kiraDurumu.not" etiket="Not (videoda geçmez)" aciklama="Kontrol raporunda gösterilir" hata={h["kiraDurumu.not"]}>
          <Input id="kiraDurumu.not" name="kiraDurumu.not" defaultValue={d["kiraDurumu.not"] ?? ""} />
        </Alan>
      </Bolum>

      {gorunum ? (
        <Bolum baslik="Görünüm" aciklama="Videonun teması, fon müziği ve kapanış sahnesinin arka planı. Değiştirmek senaryoyu silmez; video yeniden üretilir.">
          <Izgara>
            <Alan ad="gorunum.tema" etiket="Tema">
              <NativeSelect id="gorunum.tema" name="gorunum.tema" defaultValue={d["gorunum.tema"] ?? ""} className="w-full">
                <NativeSelectOption value="">Şirket varsayılanı ({gorunum.ofisTemaAdi})</NativeSelectOption>
                {TEMA_ADLARI.map((ad) => (
                  <NativeSelectOption key={ad} value={ad}>
                    {TEMALAR[ad].ad}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Alan>
            <Alan ad="gorunum.muzik" etiket="Müzik">
              <NativeSelect id="gorunum.muzik" name="gorunum.muzik" defaultValue={d["gorunum.muzik"] ?? ""} className="w-full">
                <NativeSelectOption value="">Şirket varsayılanı ({gorunum.ofisMuzigi ?? "müziksiz"})</NativeSelectOption>
                <NativeSelectOption value="yok">Müziksiz</NativeSelectOption>
                <MuzikSecenekleri muzikler={gorunum.muzikler} />
              </NativeSelect>
            </Alan>
          </Izgara>
          <div className="flex flex-col gap-1.5">
            <Label>Kapanış arka planı</Label>
            <p className="text-xs text-muted-foreground">Son sahnede (fiyat ve telefon kartı) arkada görünür. Şirket resimleri Şirket Ayarları'ndan yüklenir.</p>
            <ResimSecici ad="gorunum.resim" secenekler={gorunum.ilanResimSecenekleri} varsayilan={d["gorunum.resim"] ?? ""} />
          </div>
        </Bolum>
      ) : null}

      {durum.mesaj ? (
        <Alert variant="destructive" aria-live="polite">
          <AlertDescription>{durum.mesaj}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex justify-end gap-2">
        <Link href={ilanId ? `/ilan/${ilanId}` : "/"} className={buttonVariants({ variant: "outline", size: "lg" })}>
          Vazgeç
        </Link>
        <Button type="submit" size="lg" disabled={bekliyor}>
          {bekliyor ? "Kaydediliyor…" : ilanId ? "Kaydet" : "Kaydet ve fotoğraflara geç"}
        </Button>
      </div>
    </form>
  );
}

function Bolum({ baslik, aciklama, children }: { baslik: string; aciklama?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{baslik}</CardTitle>
        {aciklama ? <CardDescription>{aciklama}</CardDescription> : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">{children}</CardContent>
    </Card>
  );
}

const Izgara = ({ children }: { children: React.ReactNode }) => (
  <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
);

function Alan({ ad, etiket, aciklama, hata, children }: { ad: string; etiket: string; aciklama?: string | undefined; hata?: string | undefined; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={ad}>{etiket}</Label>
      {children}
      {hata ? (
        <p id={`${ad}-hata`} className="text-sm text-destructive">
          {hata}
        </p>
      ) : aciklama ? (
        <p className="text-xs text-muted-foreground">{aciklama}</p>
      ) : null}
    </div>
  );
}

type AlanProps = { ad: string; etiket: string; d: FormAlanlari; h: Record<string, string> };

function MetinAlani({
  ad,
  etiket,
  d,
  h,
  aciklama,
  yerTutucu,
  sayisal,
  tur = "text",
  liste,
}: AlanProps & { aciklama?: string; yerTutucu?: string; sayisal?: boolean; tur?: "text" | "tel"; liste?: string }) {
  return (
    <Alan ad={ad} etiket={etiket} aciklama={aciklama} hata={h[ad]}>
      <Input
        id={ad}
        name={ad}
        type={tur}
        defaultValue={d[ad] ?? ""}
        placeholder={yerTutucu}
        inputMode={sayisal ? "decimal" : undefined}
        list={liste}
        autoComplete="off"
        aria-invalid={Boolean(h[ad])}
        aria-describedby={h[ad] ? `${ad}-hata` : undefined}
      />
    </Alan>
  );
}

function OnayKutusu({ ad, d }: { ad: string; d: FormAlanlari }) {
  return (
    <label className="flex items-center gap-2 pt-7 text-sm max-sm:pt-0">
      <input type="checkbox" name={ad} defaultChecked={d[ad] === "on"} className="size-4 accent-primary" />
      Bu bilgiyi doğruladım
    </label>
  );
}

function EvetHayir({ ad, etiket, d }: { ad: string; etiket: string; d: FormAlanlari }) {
  return (
    <Alan ad={ad} etiket={etiket}>
      <NativeSelect id={ad} name={ad} defaultValue={d[ad] ?? ""} className="w-full">
        <NativeSelectOption value="">Belirtilmedi</NativeSelectOption>
        <NativeSelectOption value="evet">Evet</NativeSelectOption>
        <NativeSelectOption value="hayir">Hayır</NativeSelectOption>
      </NativeSelect>
    </Alan>
  );
}

const Oneriler = ({ id, degerler }: { id: string; degerler: string[] }) => (
  <datalist id={id}>
    {degerler.map((o) => (
      <option key={o} value={o} />
    ))}
  </datalist>
);
