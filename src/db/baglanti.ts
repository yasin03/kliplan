import { drizzle } from "drizzle-orm/node-postgres";
import * as sema from "./sema.js";

export function veritabaniOlustur(url = process.env.DATABASE_URL) {
  if (!url) throw new Error("DATABASE_URL tanımlı değil. .env.example dosyasındaki değeri .env'e kopyalayın.");
  return drizzle({ connection: url, schema: sema, casing: "snake_case" });
}

export type Veritabani = ReturnType<typeof veritabaniOlustur>;
