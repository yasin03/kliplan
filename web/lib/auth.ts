import { nextCookies } from "better-auth/next-js";
import { sql } from "drizzle-orm";
import { havuzdanVeritabani, veritabaniOlustur, type Veritabani } from "@cekirdek/db/baglanti.js";
import type { Depolama } from "@cekirdek/depolama/Depolama.js";
import { depolamaOlustur } from "@cekirdek/depolama/index.js";
import { kimlikOlustur } from "@cekirdek/kimlik/auth.js";
import { depoOlustur } from "@cekirdek/veri/depo.js";
import type { Yetki } from "@cekirdek/veri/yetki.js";

/**
 * Geliştirmede her kod değişikliğinde yeni bağlantı havuzu açılmasın diye havuz tek örnek tutulur. Drizzle nesnesi ise
 * her yüklemede güncel şemayla yeniden kurulur; `sema.ts` değişince (yeni tablo) sunucuyu yeniden başlatmak gerekmez.
 */
const kuresel = globalThis as unknown as { kliplanHavuz?: Veritabani["$client"]; kliplanDepolama?: Depolama };

// Veritabanı bu dosyanın dışına verilmez; ofise bağlı veriye yalnızca `depoAl` ile erişilir.
const db = kuresel.kliplanHavuz ? havuzdanVeritabani(kuresel.kliplanHavuz) : veritabaniOlustur();
kuresel.kliplanHavuz = db.$client;
// Geliştirmede her yüklemede yeniden kurulur: önbellekteki nesne eski kodu (ör. anahtar kuralları) sunucu yeniden başlayana kadar tutardı.
const yeniDepolama = () => depolamaOlustur(process.env.KLIPLAN_KOK ?? process.cwd());
export const depolama = process.env.NODE_ENV === "development" ? yeniDepolama() : (kuresel.kliplanDepolama ??= yeniDepolama());

// nextCookies, sunucu eylemlerinde çerezleri ayarlar; listede son olmalı.
export const auth = kimlikOlustur(db, [nextCookies()]);

export const depoAl = (yetki: Yetki) => depoOlustur(db, yetki, depolama);

/** Sağlık kontrolü (`/api/saglik`): veritabanına ulaşılıyor mu. */
export async function veritabaniCalisiyor(): Promise<boolean> {
  try {
    await db.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}
