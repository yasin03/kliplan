CREATE TABLE "sirket_resmi" (
	"id" text PRIMARY KEY NOT NULL,
	"ofis_id" text NOT NULL,
	"anahtar" text NOT NULL,
	"genislik" integer NOT NULL,
	"yukseklik" integer NOT NULL,
	"olusturma" timestamp with time zone DEFAULT now() NOT NULL,
	"guncelleme" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ilan" ADD COLUMN "resim_secimi" text DEFAULT 'ofis' NOT NULL;--> statement-breakpoint
ALTER TABLE "ilan" ADD COLUMN "resim_id" text;--> statement-breakpoint
ALTER TABLE "ofis" ADD COLUMN "cep_telefonu" text;--> statement-breakpoint
ALTER TABLE "ofis" ADD COLUMN "adres" text;--> statement-breakpoint
ALTER TABLE "ofis" ADD COLUMN "il" text;--> statement-breakpoint
ALTER TABLE "ofis" ADD COLUMN "ilce" text;--> statement-breakpoint
ALTER TABLE "ofis" ADD COLUMN "eposta" text;--> statement-breakpoint
ALTER TABLE "ofis" ADD COLUMN "web" text;--> statement-breakpoint
ALTER TABLE "ofis" ADD COLUMN "yetkili_adi" text;--> statement-breakpoint
ALTER TABLE "ofis" ADD COLUMN "yetkili_soyadi" text;--> statement-breakpoint
ALTER TABLE "ofis" ADD COLUMN "kapanis_alanlari" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "ofis" ADD COLUMN "varsayilan_resim_id" text;--> statement-breakpoint
ALTER TABLE "sirket_resmi" ADD CONSTRAINT "sirket_resmi_ofis_id_ofis_id_fk" FOREIGN KEY ("ofis_id") REFERENCES "public"."ofis"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sirket_resmi_ofis_id_index" ON "sirket_resmi" USING btree ("ofis_id");--> statement-breakpoint
ALTER TABLE "ilan" ADD CONSTRAINT "ilan_resim_id_sirket_resmi_id_fk" FOREIGN KEY ("resim_id") REFERENCES "public"."sirket_resmi"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ofis" ADD CONSTRAINT "ofis_varsayilan_resim_id_sirket_resmi_id_fk" FOREIGN KEY ("varsayilan_resim_id") REFERENCES "public"."sirket_resmi"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ofis_ad_index" ON "ofis" USING btree ("ad");