CREATE TABLE "muzik" (
	"id" text PRIMARY KEY NOT NULL,
	"ofis_id" text,
	"ad" text NOT NULL,
	"anahtar" text NOT NULL,
	"icerik_turu" text NOT NULL,
	"sure_sn" real NOT NULL,
	"boyut_bayt" integer NOT NULL,
	"lisans" text NOT NULL,
	"beyan" text,
	"beyan_eden_id" text,
	"beyan_eden_ad" text,
	"olusturma" timestamp with time zone DEFAULT now() NOT NULL,
	"guncelleme" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ilan" ADD COLUMN "tema" text;--> statement-breakpoint
ALTER TABLE "ilan" ADD COLUMN "muzik_secimi" text DEFAULT 'ofis' NOT NULL;--> statement-breakpoint
ALTER TABLE "ilan" ADD COLUMN "muzik_id" text;--> statement-breakpoint
ALTER TABLE "ofis" ADD COLUMN "varsayilan_muzik_id" text;--> statement-breakpoint
ALTER TABLE "muzik" ADD CONSTRAINT "muzik_ofis_id_ofis_id_fk" FOREIGN KEY ("ofis_id") REFERENCES "public"."ofis"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "muzik" ADD CONSTRAINT "muzik_beyan_eden_id_user_id_fk" FOREIGN KEY ("beyan_eden_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "muzik_ofis_id_index" ON "muzik" USING btree ("ofis_id");--> statement-breakpoint
ALTER TABLE "ilan" ADD CONSTRAINT "ilan_muzik_id_muzik_id_fk" FOREIGN KEY ("muzik_id") REFERENCES "public"."muzik"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ofis" ADD CONSTRAINT "ofis_varsayilan_muzik_id_muzik_id_fk" FOREIGN KEY ("varsayilan_muzik_id") REFERENCES "public"."muzik"("id") ON DELETE set null ON UPDATE no action;