CREATE TYPE "public"."ilan_durumu" AS ENUM('taslak', 'uretiliyor', 'kontrol_bekliyor', 'onaylandi', 'hata');--> statement-breakpoint
CREATE TYPE "public"."is_durumu" AS ENUM('bekliyor', 'calisiyor', 'tamamlandi', 'hata');--> statement-breakpoint
CREATE TYPE "public"."is_turu" AS ENUM('senaryo', 'video');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fotograf" (
	"id" text PRIMARY KEY NOT NULL,
	"ofis_id" text NOT NULL,
	"ilan_id" text NOT NULL,
	"sira" integer NOT NULL,
	"dosya_adi" text NOT NULL,
	"tur" text NOT NULL,
	"anahtar" text NOT NULL,
	"olusturma" timestamp with time zone DEFAULT now() NOT NULL,
	"guncelleme" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ilan" (
	"id" text PRIMARY KEY NOT NULL,
	"ofis_id" text NOT NULL,
	"olusturan_id" text,
	"durum" "ilan_durumu" DEFAULT 'taslak' NOT NULL,
	"veri" jsonb NOT NULL,
	"senaryo" jsonb,
	"hata" jsonb,
	"olusturma" timestamp with time zone DEFAULT now() NOT NULL,
	"guncelleme" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ofis" (
	"id" text PRIMARY KEY NOT NULL,
	"ad" text NOT NULL,
	"telefon" text,
	"yetki_belge_no" text,
	"logo_anahtari" text,
	"vurgu_rengi" text,
	"tema" text DEFAULT 'koyu' NOT NULL,
	"olusturma" timestamp with time zone DEFAULT now() NOT NULL,
	"guncelleme" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "uretim_isi" (
	"id" text PRIMARY KEY NOT NULL,
	"ofis_id" text NOT NULL,
	"ilan_id" text NOT NULL,
	"tur" "is_turu" NOT NULL,
	"durum" "is_durumu" DEFAULT 'bekliyor' NOT NULL,
	"hata" jsonb,
	"maliyet_usd" real,
	"baslangic" timestamp with time zone,
	"bitis" timestamp with time zone,
	"olusturma" timestamp with time zone DEFAULT now() NOT NULL,
	"guncelleme" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ofis_id" text,
	"rol" text DEFAULT 'uye' NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video" (
	"id" text PRIMARY KEY NOT NULL,
	"ofis_id" text NOT NULL,
	"ilan_id" text NOT NULL,
	"surum" integer NOT NULL,
	"video_anahtari" text NOT NULL,
	"kapak_anahtari" text NOT NULL,
	"rapor_anahtari" text NOT NULL,
	"senaryo_anahtari" text NOT NULL,
	"sure_sn" real NOT NULL,
	"boyut_bayt" integer NOT NULL,
	"maliyet_usd" real NOT NULL,
	"kontrol_listesi" jsonb,
	"onaylayan_id" text,
	"onay_zamani" timestamp with time zone,
	"olusturma" timestamp with time zone DEFAULT now() NOT NULL,
	"guncelleme" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fotograf" ADD CONSTRAINT "fotograf_ofis_id_ofis_id_fk" FOREIGN KEY ("ofis_id") REFERENCES "public"."ofis"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fotograf" ADD CONSTRAINT "fotograf_ilan_id_ilan_id_fk" FOREIGN KEY ("ilan_id") REFERENCES "public"."ilan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ilan" ADD CONSTRAINT "ilan_ofis_id_ofis_id_fk" FOREIGN KEY ("ofis_id") REFERENCES "public"."ofis"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ilan" ADD CONSTRAINT "ilan_olusturan_id_user_id_fk" FOREIGN KEY ("olusturan_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uretim_isi" ADD CONSTRAINT "uretim_isi_ofis_id_ofis_id_fk" FOREIGN KEY ("ofis_id") REFERENCES "public"."ofis"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uretim_isi" ADD CONSTRAINT "uretim_isi_ilan_id_ilan_id_fk" FOREIGN KEY ("ilan_id") REFERENCES "public"."ilan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_ofis_id_ofis_id_fk" FOREIGN KEY ("ofis_id") REFERENCES "public"."ofis"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video" ADD CONSTRAINT "video_ofis_id_ofis_id_fk" FOREIGN KEY ("ofis_id") REFERENCES "public"."ofis"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video" ADD CONSTRAINT "video_ilan_id_ilan_id_fk" FOREIGN KEY ("ilan_id") REFERENCES "public"."ilan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video" ADD CONSTRAINT "video_onaylayan_id_user_id_fk" FOREIGN KEY ("onaylayan_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_index" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fotograf_ilan_id_dosya_adi_index" ON "fotograf" USING btree ("ilan_id","dosya_adi");--> statement-breakpoint
CREATE INDEX "fotograf_ofis_id_index" ON "fotograf" USING btree ("ofis_id");--> statement-breakpoint
CREATE INDEX "ilan_ofis_id_guncelleme_index" ON "ilan" USING btree ("ofis_id","guncelleme");--> statement-breakpoint
CREATE INDEX "session_user_id_index" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "uretim_isi_ilan_id_index" ON "uretim_isi" USING btree ("ilan_id");--> statement-breakpoint
CREATE INDEX "uretim_isi_ofis_id_index" ON "uretim_isi" USING btree ("ofis_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_index" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "video_ilan_id_surum_index" ON "video" USING btree ("ilan_id","surum");--> statement-breakpoint
CREATE INDEX "video_ofis_id_index" ON "video" USING btree ("ofis_id");