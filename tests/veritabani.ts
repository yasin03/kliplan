import path from "node:path";
import { config } from "dotenv";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import { veritabaniOlustur, type Veritabani } from "../src/db/baglanti.js";
import { user } from "../src/db/sema.js";

config({ quiet: true });

/**
 * Testler geliştirme veritabanına dokunmaz. Her test dosyası aynı sunucuda kendi veritabanını
 * (`kliplan_test_<ad>`) kullanır; dosyalar paralel çalışırken birbirinin tablolarını boşaltmaz.
 */
function testAdresi(ad: string): string | undefined {
  const kaynak = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!kaynak) return undefined;
  const adres = new URL(kaynak);
  adres.pathname = `/kliplan_test_${ad}`;
  return adres.toString();
}

/** Test veritabanını hazırlar; PostgreSQL'e ulaşılamazsa (ör. OrbStack kapalı) `null` döner ve testler atlanır. */
export async function testVeritabani(ad: string): Promise<Veritabani | null> {
  const adres = testAdresi(ad);
  const yonetim = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!adres || !yonetim) return null;
  const istemci = new pg.Client({ connectionString: yonetim, connectionTimeoutMillis: 2000 });
  try {
    await istemci.connect();
    const vtAdi = new URL(adres).pathname.slice(1);
    const { rowCount } = await istemci.query("select 1 from pg_database where datname = $1", [vtAdi]);
    if (!rowCount) await istemci.query(`create database "${vtAdi}"`);
  } catch {
    console.warn("⚠ Veritabanı testleri atlandı: PostgreSQL'e bağlanılamadı. Başlatmak için: docker compose up -d");
    return null;
  } finally {
    await istemci.end().catch(() => {});
  }
  const db = veritabaniOlustur(adres);
  await migrate(db, { migrationsFolder: path.resolve(import.meta.dirname, "../src/db/gocler") });
  return db;
}

export async function tablolariBosalt(db: Veritabani): Promise<void> {
  await db.execute(sql`truncate table "user", ofis, session, account, verification, ilan, fotograf, uretim_isi, video cascade`);
}

/** Yetki testleri için giriş bilgisi olmayan sade kullanıcı kaydı. */
export async function testKullanicisi(db: Veritabani, id: string, ofisId: string | null, rol = "uye") {
  await db.insert(user).values({ id, name: id, email: `${id}@test.local`, ofisId, rol });
}
