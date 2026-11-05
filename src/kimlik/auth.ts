import { betterAuth, type BetterAuthPlugin } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { Veritabani } from "../db/baglanti.js";
import { account, session, user, verification } from "../db/sema.js";

export const EN_AZ_SIFRE_UZUNLUGU = 10;

/**
 * Giriş yapılandırması. Açık kayıt kapalı; hesapları admin `npm run kullanici-ekle` ile açar.
 * Web uygulaması Next.js çerez eklentisini `eklentiler` ile verir.
 */
export function kimlikOlustur(db: Veritabani, eklentiler: BetterAuthPlugin[] = []) {
  return betterAuth({
    database: drizzleAdapter(db, { provider: "pg", schema: { user, session, account, verification } }),
    emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: EN_AZ_SIFRE_UZUNLUGU },
    user: {
      additionalFields: {
        ofisId: { type: "string", required: false, input: false },
        rol: { type: "string", required: false, defaultValue: "uye", input: false },
      },
    },
    plugins: eklentiler,
  });
}

export type Kimlik = ReturnType<typeof kimlikOlustur>;
