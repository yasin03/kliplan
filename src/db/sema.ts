import { type AnyPgColumn, boolean, index, integer, jsonb, pgEnum, pgTable, real, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import type { KapanisAlani } from "../veri/kapanisAlanlari.js";

/**
 * Veritabanı şeması. Sütun adları kodda camelCase, veritabanında snake_case (`casing: "snake_case"`).
 * Müşteri ayrımı için ofise bağlı her tabloda `ofisId` tutulur; sorgular bu alanla filtrelenir.
 */

const kimlik = () =>
  text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());
const zaman = () => timestamp({ withTimezone: true });
const zamanDamgalari = () => ({
  olusturma: zaman().notNull().defaultNow(),
  guncelleme: zaman()
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});


export const ofis = pgTable(
  "ofis",
  {
    id: kimlik(),
    /** Panelde "şirket adı". `kullanici-ekle --ofis` şirketi bu adla bulduğu için benzersiz. */
    ad: text().notNull(),
    /** Sabit telefon. Şirket ayarlarından doldurulur; yeni ilan formu cep telefonu yoksa bununla başlar. */
    telefon: text(),
    cepTelefonu: text(),
    yetkiBelgeNo: text(),
    adres: text(),
    il: text(),
    ilce: text(),
    eposta: text(),
    /** Protokolsüz saklanır, ör. `temurlargrup.com`. */
    web: text(),
    yetkiliAdi: text(),
    yetkiliSoyadi: text(),
    kapanisAlanlari: jsonb().$type<KapanisAlani[]>().notNull().default([]),
    logoAnahtari: text(),
    vurguRengi: text(),
    /** İlanlarda varsayılan tema (`TEMA_ADLARI`); ilan başına değiştirilebilir. */
    tema: text().notNull().default("koyu"),
    /** İlanlarda varsayılan müzik; boşsa müziksiz. */
    varsayilanMuzikId: text().references((): AnyPgColumn => muzik.id, { onDelete: "set null" }),
    /** İlanlarda varsayılan kapanış arka planı; boşsa ilan fotoğrafı. */
    varsayilanResimId: text().references((): AnyPgColumn => sirketResmi.id, { onDelete: "set null" }),
    ...zamanDamgalari(),
  },
  (t) => [uniqueIndex().on(t.ad)],
);

/** Şirketin kendi resimleri (ör. ofis içi). Seçilen resim videonun kapanış sahnesinde arka plan olur. */
export const sirketResmi = pgTable(
  "sirket_resmi",
  {
    id: kimlik(),
    ofisId: text()
      .notNull()
      .references((): AnyPgColumn => ofis.id, { onDelete: "cascade" }),
    anahtar: text().notNull(),
    genislik: integer().notNull(),
    yukseklik: integer().notNull(),
    ...zamanDamgalari(),
  },
  (t) => [index().on(t.ofisId)],
);

/**
 * Fon müzikleri. `ofisId` boşsa hazır kütüphane (admin ekler, lisansını admin sağlar, bütün ofisler görür);
 * doluysa ofisin kendi yüklemesi (yükleyen ticari kullanım iznini beyan eder). Lisans ve beyan kontrol raporuna yazılır.
 */
export const muzik = pgTable(
  "muzik",
  {
    id: kimlik(),
    ofisId: text().references((): AnyPgColumn => ofis.id, { onDelete: "cascade" }),
    ad: text().notNull(),
    anahtar: text().notNull(),
    icerikTuru: text().notNull(),
    sureSn: real().notNull(),
    boyutBayt: integer().notNull(),
    /** Ticari kullanım izninin kaynağı: lisans adı, satın alma bağlantısı, sözleşme no. */
    lisans: text().notNull(),
    /** Ofis yüklemesinde onaylanan beyanın tam metni; kütüphanede boş. */
    beyan: text(),
    /** Beyan eden kullanıcı; hesap silinse de adı kayıtta kalır. */
    beyanEdenId: text().references((): AnyPgColumn => user.id, { onDelete: "set null" }),
    beyanEdenAd: text(),
    ...zamanDamgalari(),
  },
  (t) => [index().on(t.ofisId)],
);

// ── Better Auth tabloları. Tablo ve alan adları Better Auth'un beklediği gibi olmalı. ──

export const user = pgTable("user", {
  id: text().primaryKey(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean().notNull().default(false),
  image: text(),
  createdAt: zaman().notNull().defaultNow(),
  updatedAt: zaman()
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  /** Admin hesaplarında boş olabilir. */
  ofisId: text().references(() => ofis.id, { onDelete: "restrict" }),
  /** `admin` tüm ofisleri görür; `uye` yalnızca kendi ofisini. */
  rol: text().notNull().default("uye"),
});

export const session = pgTable(
  "session",
  {
    id: text().primaryKey(),
    expiresAt: zaman().notNull(),
    token: text().notNull().unique(),
    createdAt: zaman().notNull().defaultNow(),
    updatedAt: zaman()
      .notNull()
      .$onUpdate(() => new Date()),
    ipAddress: text(),
    userAgent: text(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index().on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text().primaryKey(),
    accountId: text().notNull(),
    providerId: text().notNull(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: zaman(),
    refreshTokenExpiresAt: zaman(),
    scope: text(),
    password: text(),
    createdAt: zaman().notNull().defaultNow(),
    updatedAt: zaman()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [index().on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text().primaryKey(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: zaman().notNull(),
    createdAt: zaman().notNull().defaultNow(),
    updatedAt: zaman()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index().on(t.identifier)],
);

// ── İlanlar ve üretim ──

/** İlanın müzik ve kapanış resmi seçimi: `ofis` şirketin varsayılanı · `yok` hiç · `secili` belirli kayıt (silinmişse şirket varsayılanı). */
export const SECIMLER = ["ofis", "yok", "secili"] as const;
export type Secim = (typeof SECIMLER)[number];

export const ILAN_DURUMLARI = ["taslak", "uretiliyor", "kontrol_bekliyor", "onaylandi", "hata"] as const;
export const ilanDurumu = pgEnum("ilan_durumu", ILAN_DURUMLARI);

/** Panelde gösterilen hata: hangi adımda ne oldu, nasıl çözülür (`AdimHatasi`). */
export type KayitliHata = { adim: string; mesaj: string; cozum: string };

export const ilan = pgTable(
  "ilan",
  {
    id: kimlik(),
    ofisId: text()
      .notNull()
      .references(() => ofis.id, { onDelete: "cascade" }),
    olusturanId: text().references(() => user.id, { onDelete: "set null" }),
    durum: ilanDurumu().notNull().default("taslak"),
    /** Formdan gelen ilan bilgileri; `ilan.json` ile aynı yapı (fotoğraflar ayrı tabloda). */
    veri: jsonb().$type<Record<string, unknown>>().notNull(),
    /** Üretilen ve kullanıcının düzenlediği senaryo (`SenaryoSonucu`). Kullanılmadan önce her seferinde yeniden doğrulanır. */
    senaryo: jsonb().$type<unknown>(),
    hata: jsonb().$type<KayitliHata>(),
    /** Boşsa ofisin varsayılan teması. */
    tema: text(),
    /** `ofis`: ofisin varsayılan müziği · `yok`: müziksiz · `secili`: `muzikId` (silinmişse ofis varsayılanı). */
    muzikSecimi: text().$type<Secim>().notNull().default("ofis"),
    muzikId: text().references(() => muzik.id, { onDelete: "set null" }),
    /** Kapanış arka planı; seçim kuralları müzikle aynı. */
    resimSecimi: text().$type<Secim>().notNull().default("ofis"),
    resimId: text().references(() => sirketResmi.id, { onDelete: "set null" }),
    ...zamanDamgalari(),
  },
  (t) => [index().on(t.ofisId, t.guncelleme)],
);

export const fotograf = pgTable(
  "fotograf",
  {
    id: kimlik(),
    ofisId: text()
      .notNull()
      .references(() => ofis.id, { onDelete: "cascade" }),
    ilanId: text()
      .notNull()
      .references(() => ilan.id, { onDelete: "cascade" }),
    sira: integer().notNull(),
    /** Pipeline'da `ilan.json` içindeki `dosya` adı. */
    dosyaAdi: text().notNull(),
    tur: text().notNull(),
    /** Dosya deposundaki anahtar. */
    anahtar: text().notNull(),
    /** İşlenmiş (küçültülmüş) dosyanın boyutları; düşük çözünürlük uyarısı için. */
    genislik: integer().notNull(),
    yukseklik: integer().notNull(),
    ...zamanDamgalari(),
  },
  (t) => [uniqueIndex().on(t.ilanId, t.dosyaAdi), index().on(t.ofisId)],
);

export const isTuru = pgEnum("is_turu", ["senaryo", "video"]);
export const isDurumu = pgEnum("is_durumu", ["bekliyor", "calisiyor", "tamamlandi", "hata"]);

/** Kuyruğa atılan her işin kaydı; hata ve maliyet geçmişi burada kalır. */
export const uretimIsi = pgTable(
  "uretim_isi",
  {
    id: kimlik(),
    ofisId: text()
      .notNull()
      .references(() => ofis.id, { onDelete: "cascade" }),
    ilanId: text()
      .notNull()
      .references(() => ilan.id, { onDelete: "cascade" }),
    tur: isTuru().notNull(),
    durum: isDurumu().notNull().default("bekliyor"),
    /** Panelde gösterilen son adım, ör. "4/6 Dış ses üretiliyor…". */
    asama: text(),
    /** Render ilerlemesi (0-1); diğer adımlarda boş. */
    ilerleme: real(),
    /** Önbelleği yok sayarak üret (senaryoyu yeniden yazdırmak için). */
    zorla: boolean().notNull().default(false),
    hata: jsonb().$type<KayitliHata>(),
    maliyetUsd: real(),
    baslangic: zaman(),
    bitis: zaman(),
    ...zamanDamgalari(),
  },
  (t) => [index().on(t.ilanId), index().on(t.ofisId)],
);

/** Her yeniden üretim yeni bir sürüm olarak saklanır. */
export const video = pgTable(
  "video",
  {
    id: kimlik(),
    ofisId: text()
      .notNull()
      .references(() => ofis.id, { onDelete: "cascade" }),
    ilanId: text()
      .notNull()
      .references(() => ilan.id, { onDelete: "cascade" }),
    surum: integer().notNull(),
    videoAnahtari: text().notNull(),
    kapakAnahtari: text().notNull(),
    raporAnahtari: text().notNull(),
    senaryoAnahtari: text().notNull(),
    sureSn: real().notNull(),
    boyutBayt: integer().notNull(),
    maliyetUsd: real().notNull(),
    /** Sahte sağlayıcılarla (`--mock`) üretildi; müşteriye gönderilmez, onaylanamaz. */
    test: boolean().notNull().default(false),
    /** Onaylayan kullanıcının işaretlediği kontrol listesi maddeleri. */
    kontrolListesi: jsonb().$type<string[]>(),
    onaylayanId: text().references(() => user.id, { onDelete: "set null" }),
    onayZamani: zaman(),
    ...zamanDamgalari(),
  },
  (t) => [uniqueIndex().on(t.ilanId, t.surum), index().on(t.ofisId)],
);
