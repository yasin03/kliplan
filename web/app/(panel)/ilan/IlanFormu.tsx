"use client";

import Link from "next/link";
import { useActionState } from "react";
import { TEMA_ADLARI, TEMALAR } from "@cekirdek/remotion/temalar.js";
import type { GizlenebilirAlan } from "@cekirdek/schema/ilan.js";
import { KULLANIM_DURUMLARI, type FormAlanlari } from "@cekirdek/veri/ilanFormu.js";
import { GosterAnahtari } from "@/components/Anahtar";
import { FormSatiri } from "@/components/FormSatiri";
import { GosterilenSecim } from "@/components/GosterilenSecim";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  /** Logo, tema, müzik ve kapanış resmi seçenekleri. Admin yeni ilan açarken şirket henüz belli olmadığı için verilmez. */
  gorunum?: GorunumSecenekleri;
};

export function IlanFormu({ ilanId, baslangic, ofisAdi, ofisler, gorunum }: Props) {
  const [durum, gonder, bekliyor] = useActionState<FormDurumu, FormData>(ilanKaydet.bind(null, ilanId), {
    hatalar: {},
    mesaj: null,
    degerler: baslangic,
  });
  const { degerler: d, hatalar: h } = durum;

  const goster = (alan: GizlenebilirAlan, etiket: string) => <GosterAnahtari alan={alan} etiket={etiket} baslangic={d[`gizle.${alan}`] !== "on"} />;

  return (
    // Gönderimden sonra React formu sıfırlar; anahtar değişince alanlar dönen değerlerle yeniden kurulur.
    <form action={gonder} key={JSON.stringify(d)} className="flex flex-col gap-4" noValidate>
      {ofisler ? (
        <Bolum baslik="Şirket" aciklama="Yönetici olarak ilanı hangi şirket adına açtığınızı seçin. Logo, tema, müzik ve kapanış resmi şirketin varsayılanlarıyla başlar; ilan sayfasından değiştirilebilir.">
          <FormSatiri ad="ofisId" etiket="Şirket" hata={h.ofisId}>
            <NativeSelect id="ofisId" name="ofisId" defaultValue={d.ofisId ?? ""} className="w-full" aria-invalid={Boolean(h.ofisId)}>
              <NativeSelectOption value="">Seçin</NativeSelectOption>
              {ofisler.map((o) => (
                <NativeSelectOption key={o.id} value={o.id}>
                  {o.ad}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </FormSatiri>
        </Bolum>
      ) : null}

      <p className="text-sm text-muted-foreground">
        Her bilginin yanındaki <span className="font-medium text-foreground">Videoda</span> anahtarıyla bilgiyi bu ilanın videosundan çıkarabilirsiniz (ör. fiyatsız bir video). Seçimler
        kaydedilir; her video sürümü üretildiği andaki seçimleri saklar. Bir bilgiyi gizleyip açtığınızda senaryo yeniden üretilir.
      </p>

      {gorunum ? (
        <Bolum baslik="Logo ve kapanış resmi" aciklama="Bu ilanın videosunda hangi logonun ve son sahnede hangi şirket resminin görüneceği. Logo ve resimler Şirket Ayarları'ndan yüklenir.">
          <GosterilenSecim
            ad="gorunum.logo"
            etiket="Logo"
            aciklama="Videonun üst köşesinde ve kapanış kartında. Kapalıysa yalnızca şirket adı yazar."
            secenekler={gorunum.ilanLogoSecenekleri}
            varsayilan={d["gorunum.logo"] ?? ""}
            bicim="logo"
          />
          <GosterilenSecim
            ad="gorunum.resim"
            etiket="Kapanış arka planı"
            aciklama="Son sahnede fiyat ve telefon kartının arkasında. Kapalıysa sahnenin ilan fotoğrafı görünür."
            secenekler={gorunum.ilanResimSecenekleri}
            varsayilan={d["gorunum.resim"] ?? ""}
          />
        </Bolum>
      ) : null}

      <Bolum baslik="Daire" aciklama="İlandaki bilgileri olduğu gibi girin.">
        <MetinAlani ad="ilanNo" etiket="İlan numarası" d={d} h={h} sayisal aciklama="Sahibinden vb. ilan numarası · videoda yer almaz" />
        <MetinAlani ad="odaSayisi" etiket="Oda sayısı" d={d} h={h} yerTutucu="2+1" liste="oda-sayilari" ek={goster("odaSayisi", "Oda sayısı")} />
        <MetinAlani ad="brutM2" etiket="Brüt m²" d={d} h={h} sayisal aciklama="Videoda yer almaz; net m² ile karşılaştırılır" />
        <MetinAlani ad="netM2" etiket="Net m²" d={d} h={h} sayisal ek={goster("netM2", "Net m²")} />
        <MetinAlani ad="binaYasi" etiket="Bina yaşı" d={d} h={h} sayisal aciklama="Yeni binada 0" ek={goster("binaYasi", "Bina yaşı")} />
        <MetinAlani ad="bulunduguKat" etiket="Bulunduğu kat" d={d} h={h} sayisal aciklama="Zemin kat 0, bodrum -1 · anahtar kat sayısını da kapsar" ek={goster("kat", "Kat bilgisi")} />
        <MetinAlani ad="katSayisi" etiket="Binadaki kat sayısı" d={d} h={h} sayisal />
        <datalist id="oda-sayilari">
          {["1+0", "1+1", "2+1", "3+1", "4+1", "5+1"].map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>
      </Bolum>

      <Bolum baslik="Fiyat ve konum" aciklama="Videoda gösterilen fiyat doğrulanmış olmalı. Konumu doğrulamazsanız videoda gösterilmez.">
        <MetinAlani ad="fiyatTl.deger" etiket="Fiyat (TL)" d={d} h={h} sayisal yerTutucu="4.500.000" ek={goster("fiyat", "Fiyat")} />
        <MetinAlani ad="konum.il" etiket="İl" d={d} h={h} aciklama="Anahtar il, ilçe ve mahalleyi birlikte kapsar" ek={goster("konum", "Konum")} />
        <MetinAlani ad="konum.ilce" etiket="İlçe" d={d} h={h} />
        <MetinAlani ad="konum.mahalle" etiket="Mahalle" d={d} h={h} />
        <OnayKutusu ad="onay.fiyatKonum" d={d} />
      </Bolum>

      <Bolum
        baslik="İletişim"
        aciklama={`Videonun sonunda gösterilir; gösterilen bilgiler doğrulanmış olmalı.${ofisAdi ? ` Şirket adı: ${ofisAdi}.` : ""}`}
      >
        <MetinAlani ad="telefon.deger" etiket="Telefon" d={d} h={h} tur="tel" yerTutucu="0505 709 44 88" ek={goster("telefon", "Telefon")} />
        <MetinAlani
          ad="yetkiBelgeNo.deger"
          etiket="Yetki belge numarası"
          d={d}
          h={h}
          sayisal
          aciklama="Emlak ilanlarında gösterilmesi yasal zorunluluktur; gizlerseniz sorumluluk sizdedir."
          ek={goster("yetkiBelgeNo", "Yetki belge numarası")}
        />
        <OnayKutusu ad="onay.iletisim" d={d} />
      </Bolum>

      <Bolum baslik="Özellikler" aciklama="Boş bıraktığınız alanlar videoda geçmez.">
        <MetinAlani ad="isitma" etiket="Isıtma" d={d} h={h} liste="isitma" ek={goster("isitma", "Isıtma")} />
        <MetinAlani ad="mutfak" etiket="Mutfak" d={d} h={h} liste="mutfak" ek={goster("mutfak", "Mutfak")} />
        <MetinAlani ad="tapu" etiket="Tapu durumu" d={d} h={h} liste="tapu" ek={goster("tapu", "Tapu durumu")} />
        <EvetHayir ad="esyali" etiket="Eşyalı" d={d} ek={goster("esyali", "Eşya durumu")} />
        <EvetHayir ad="krediyeUygun" etiket="Krediye uygun" d={d} ek={goster("krediyeUygun", "Krediye uygunluk")} />
        <FormSatiri ad="ozellikler" etiket="Diğer özellikler" aciklama="Her satıra bir özellik, ör. Cam balkon" hata={h.ozellikler} ek={goster("ozellikler", "Diğer özellikler")}>
          <Textarea id="ozellikler" name="ozellikler" rows={5} defaultValue={d.ozellikler ?? ""} />
        </FormSatiri>
        <Oneriler id="isitma" degerler={["Kombi (doğalgaz)", "Merkezi sistem", "Yerden ısıtma", "Klima", "Soba"]} />
        <Oneriler id="mutfak" degerler={["Kapalı mutfak", "Açık Amerikan mutfak"]} />
        <Oneriler id="tapu" degerler={["Kat mülkiyetli", "Kat irtifaklı", "Hisseli tapu", "Arsa tapulu"]} />
      </Bolum>

      <Bolum baslik="Kullanım durumu (isteğe bağlı)" aciklama="Kira bilgisi yalnızca doğruladıysanız videoda geçer.">
        <FormSatiri ad="kiraDurumu.aciklama" etiket="Kullanım durumu" hata={h["kiraDurumu.aciklama"]} ek={goster("kiraDurumu", "Kullanım durumu")}>
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
        </FormSatiri>
        <MetinAlani ad="kiraDurumu.kiraTl" etiket="Aylık kira (TL)" d={d} h={h} sayisal />
        <MetinAlani ad="kiraDurumu.not" etiket="Not" d={d} h={h} aciklama="Videoda yer almaz; kontrol raporunda gösterilir" />
        <OnayKutusu ad="onay.kira" d={d} />
      </Bolum>

      {gorunum ? (
        <Bolum baslik="Görünüm" aciklama="Videonun teması ve fon müziği. Değiştirmek senaryoyu silmez; video yeniden üretilir.">
          <FormSatiri ad="gorunum.tema" etiket="Tema">
            <NativeSelect id="gorunum.tema" name="gorunum.tema" defaultValue={d["gorunum.tema"] ?? ""} className="w-full">
              <NativeSelectOption value="">Şirket varsayılanı ({gorunum.ofisTemaAdi})</NativeSelectOption>
              {TEMA_ADLARI.map((ad) => (
                <NativeSelectOption key={ad} value={ad}>
                  {TEMALAR[ad].ad}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </FormSatiri>
          <FormSatiri ad="gorunum.muzik" etiket="Müzik">
            <NativeSelect id="gorunum.muzik" name="gorunum.muzik" defaultValue={d["gorunum.muzik"] ?? ""} className="w-full">
              <NativeSelectOption value="">Şirket varsayılanı ({gorunum.ofisMuzigi ?? "müziksiz"})</NativeSelectOption>
              <NativeSelectOption value="yok">Müziksiz</NativeSelectOption>
              <MuzikSecenekleri muzikler={gorunum.muzikler} />
            </NativeSelect>
          </FormSatiri>
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

type AlanProps = { ad: string; etiket: string; d: FormAlanlari; h: Record<string, string>; ek?: React.ReactNode };

function MetinAlani({
  ad,
  etiket,
  d,
  h,
  ek,
  aciklama,
  yerTutucu,
  sayisal,
  tur = "text",
  liste,
}: AlanProps & { aciklama?: string; yerTutucu?: string; sayisal?: boolean; tur?: "text" | "tel"; liste?: string }) {
  return (
    <FormSatiri ad={ad} etiket={etiket} aciklama={aciklama} hata={h[ad]} ek={ek}>
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
    </FormSatiri>
  );
}

/** Bölümün sonunda bir kez: bölümdeki bütün bilgilerin doğrulandığı (`ONAY_BOLUMLERI`). */
function OnayKutusu({ ad, d }: { ad: string; d: FormAlanlari }) {
  return (
    <label className="flex items-center gap-2 border-t pt-4 text-sm font-medium">
      <input type="checkbox" name={ad} defaultChecked={d[ad] === "on"} className="size-4 accent-primary" />
      Bu bölümdeki bilgileri doğruladım
    </label>
  );
}

function EvetHayir({ ad, etiket, d, ek }: Omit<AlanProps, "h">) {
  return (
    <FormSatiri ad={ad} etiket={etiket} ek={ek}>
      <NativeSelect id={ad} name={ad} defaultValue={d[ad] ?? ""} className="w-full">
        <NativeSelectOption value="">Belirtilmedi</NativeSelectOption>
        <NativeSelectOption value="evet">Evet</NativeSelectOption>
        <NativeSelectOption value="hayir">Hayır</NativeSelectOption>
      </NativeSelect>
    </FormSatiri>
  );
}

const Oneriler = ({ id, degerler }: { id: string; degerler: string[] }) => (
  <datalist id={id}>
    {degerler.map((o) => (
      <option key={o} value={o} />
    ))}
  </datalist>
);
