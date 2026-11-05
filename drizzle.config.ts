import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ quiet: true });

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/sema.ts",
  out: "./src/db/gocler",
  casing: "snake_case",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
