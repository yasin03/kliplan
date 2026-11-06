CREATE TABLE "sirket_logosu" (
	"id" text PRIMARY KEY NOT NULL,
	"ofis_id" text NOT NULL,
	"anahtar" text NOT NULL,
	"olusturma" timestamp with time zone DEFAULT now() NOT NULL,
	"guncelleme" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ilan" ADD COLUMN "logo_secimi" text DEFAULT 'ofis' NOT NULL;--> statement-breakpoint
ALTER TABLE "ilan" ADD COLUMN "logo_id" text;--> statement-breakpoint
ALTER TABLE "ofis" ADD COLUMN "varsayilan_logo_id" text;--> statement-breakpoint
ALTER TABLE "video" ADD COLUMN "gizli_alanlar" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "sirket_logosu" ADD CONSTRAINT "sirket_logosu_ofis_id_ofis_id_fk" FOREIGN KEY ("ofis_id") REFERENCES "public"."ofis"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sirket_logosu_ofis_id_index" ON "sirket_logosu" USING btree ("ofis_id");--> statement-breakpoint
ALTER TABLE "ilan" ADD CONSTRAINT "ilan_logo_id_sirket_logosu_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."sirket_logosu"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ofis" ADD CONSTRAINT "ofis_varsayilan_logo_id_sirket_logosu_id_fk" FOREIGN KEY ("varsayilan_logo_id") REFERENCES "public"."sirket_logosu"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Eski tek logo, şirketin ilk logosu ve varsayılanı olur. Anahtar aynı kalır; dosya taşınmaz. Eski sütun 0007'de silinir.
INSERT INTO "sirket_logosu" ("id", "ofis_id", "anahtar") SELECT gen_random_uuid()::text, "id", "logo_anahtari" FROM "ofis" WHERE "logo_anahtari" IS NOT NULL;--> statement-breakpoint
UPDATE "ofis" SET "varsayilan_logo_id" = l."id" FROM "sirket_logosu" l WHERE l."ofis_id" = "ofis"."id";
