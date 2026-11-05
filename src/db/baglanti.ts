import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as sema from "./sema.js";

export function veritabaniOlustur(url = process.env.DATABASE_URL) {
  if (!url) throw new Error("DATABASE_URL tanımlı değil. .env.example dosyasındaki değeri .env'e kopyalayın.");
  return havuzdanVeritabani(new pg.Pool({ connectionString: url }));
}

/** Var olan bağlantı havuzuyla, güncel şemayı kullanan veritabanı nesnesi. Web geliştirmede havuz korunur, şema her yüklemede yenilenir. */
export function havuzdanVeritabani(havuz: pg.Pool) {
  return drizzle({ client: havuz, schema: sema, casing: "snake_case" });
}

export type Veritabani = ReturnType<typeof veritabaniOlustur>;
