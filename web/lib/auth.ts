import { nextCookies } from "better-auth/next-js";
import { veritabaniOlustur, type Veritabani } from "@cekirdek/db/baglanti.js";
import type { Depolama } from "@cekirdek/depolama/Depolama.js";
import { depolamaOlustur } from "@cekirdek/depolama/index.js";
import { kimlikOlustur } from "@cekirdek/kimlik/auth.js";
import { depoOlustur } from "@cekirdek/veri/depo.js";
import type { Yetki } from "@cekirdek/veri/yetki.js";

/** Geliştirmede her kod değişikliğinde yeni bağlantı havuzu açılmasın diye tek örnek tutulur. */
const kuresel = globalThis as unknown as { kliplanDb?: Veritabani; kliplanDepolama?: Depolama };

// Veritabanı bu dosyanın dışına verilmez; ofise bağlı veriye yalnızca `depoAl` ile erişilir.
const db = (kuresel.kliplanDb ??= veritabaniOlustur());
export const depolama = (kuresel.kliplanDepolama ??= depolamaOlustur(process.env.KLIPLAN_KOK ?? process.cwd()));

// nextCookies, sunucu eylemlerinde çerezleri ayarlar; listede son olmalı.
export const auth = kimlikOlustur(db, [nextCookies()]);

export const depoAl = (yetki: Yetki) => depoOlustur(db, yetki, depolama);
