import { z } from "zod";
import { TEMA_ADLARI } from "../remotion/temalar.js";

/** Değeri ve doğrulanıp doğrulanmadığı birlikte tutulan bilgi. `onayli: false` ise metinde kullanılmaz. */
const onayliDeger = <T extends z.ZodType>(deger: T) =>
  z.strictObject({
    deger,
    onayli: z.boolean(),
  });

export const FOTOGRAF_TURLERI = [
  "bina",
  "salon",
  "mutfak",
  "yatak_odasi",
  "banyo",
  "koridor",
  "balkon",
  "cocuk_odasi",
  "dis_mekan",
  "manzara",
  "diger",
] as const;

const bosOlmayanMetin = z.string().trim().min(1);

export const fotografSemasi = z.strictObject({
  dosya: bosOlmayanMetin.regex(/^[^/\\]+\.(jpe?g|png|webp)$/i, {
    error: "Fotoğraf dosya adı .jpg, .jpeg, .png veya .webp ile bitmeli ve klasör yolu içermemeli",
  }),
  tur: z.enum(FOTOGRAF_TURLERI),
});

export const konumSemasi = z.strictObject({
  il: bosOlmayanMetin,
  ilce: bosOlmayanMetin,
  mahalle: bosOlmayanMetin,
  onayli: z.boolean(),
});

export const kiraDurumuSemasi = z.strictObject({
  aciklama: bosOlmayanMetin,
  kiraTl: z.number().int().positive().optional(),
  onayli: z.boolean(),
  not: z.string().optional(),
});

export const ilanSemasi = z.strictObject({
  ilanNo: z.string().regex(/^\d+$/, { error: "İlan numarası yalnızca rakamlardan oluşmalı" }),
  emlakOfisi: bosOlmayanMetin,
  yetkiBelgeNo: onayliDeger(z.string().regex(/^\d+$/, { error: "Yetki belge numarası yalnızca rakamlardan oluşmalı" })),
  telefon: onayliDeger(
    z.string().regex(/^0\d{3} \d{3} \d{2} \d{2}$/, {
      error: "Telefon '0505 709 44 88' biçiminde olmalı",
    }),
  ),
  fiyatTl: onayliDeger(z.number().int().positive()),
  konum: konumSemasi,
  odaSayisi: z.string().regex(/^\d+(\.5)?\+\d+$/, { error: "Oda sayısı '2+1' biçiminde olmalı" }),
  brutM2: z.number().positive(),
  netM2: z.number().positive(),
  binaYasi: z.number().int().min(0),
  bulunduguKat: z.number().int(),
  katSayisi: z.number().int().positive(),
  isitma: bosOlmayanMetin.optional(),
  mutfak: bosOlmayanMetin.optional(),
  esyali: z.boolean().optional(),
  krediyeUygun: z.boolean().optional(),
  tapu: bosOlmayanMetin.optional(),
  ozellikler: z.array(bosOlmayanMetin).default([]),
  kiraDurumu: kiraDurumuSemasi.optional(),
  logo: bosOlmayanMetin.optional(),
  /** Renk teması: koyu, acik, sade. Verilmezse koyu. */
  tema: z.enum(TEMA_ADLARI, { error: `Tema şunlardan biri olmalı: ${TEMA_ADLARI.join(", ")}` }).optional(),
  /** Ofise özel vurgu rengi. Verilmezse temanın kendi rengi kullanılır. */
  vurguRengi: z.string().regex(/^#[0-9A-Fa-f]{6}$/, { error: "Vurgu rengi '#F2A541' biçiminde olmalı" }).optional(),
  /** Fon müziği. Yalnızca ticari kullanım izni olan yerel bir dosya; izin bilgisi kontrol raporuna yazılır. */
  muzik: z
    .strictObject({
      dosya: bosOlmayanMetin,
      lisans: bosOlmayanMetin.describe("Ticari kullanım izninin kaynağı, ör. lisans adı veya satın alma bağlantısı"),
      /** Web panelinde emlakçının yüklediği müzikte: beyan metni, beyan eden ve zamanı. Kontrol raporuna yazılır. */
      beyan: bosOlmayanMetin.optional(),
    })
    .optional(),
  /** Kapanış sahnesinde ilan fotoğrafı yerine arka plan olacak resim (ör. şirketin ofis içi), ilan klasörüne göre. */
  kapanisResmi: bosOlmayanMetin
    .regex(/^[^/\\]+\.(jpe?g|png|webp)$/i, { error: "Kapanış resmi .jpg, .jpeg, .png veya .webp olmalı ve klasör yolu içermemeli" })
    .optional(),
  /** Kapanış kartında ek satır olarak gösterilecek şirket bilgileri; yalnızca gösterilecek olanlar yazılır. */
  sirketBilgileri: z
    .strictObject({
      web: bosOlmayanMetin.optional(),
      adres: bosOlmayanMetin.optional(),
      yetkili: bosOlmayanMetin.optional(),
      eposta: bosOlmayanMetin.optional(),
    })
    .optional(),
  /** Bu ilana özel telaffuz sözlüğü; projedeki telaffuz.json ile birleştirilir. */
  telaffuz: z.record(bosOlmayanMetin, z.union([bosOlmayanMetin, z.strictObject({ ipa: bosOlmayanMetin })])).optional(),
  fotograflar: z.array(fotografSemasi).min(1),
});

export type Ilan = z.infer<typeof ilanSemasi>;
export type Fotograf = z.infer<typeof fotografSemasi>;
export type FotografTuru = (typeof FOTOGRAF_TURLERI)[number];
