import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Veritabani } from "../db/baglanti.js";
import { ofis, user } from "../db/sema.js";
import type { Kimlik } from "./auth.js";

export class KullaniciHatasi extends Error {}

export type KullaniciGirdisi = {
  eposta: string;
  ad: string;
  /** Admin hesabında verilmez. */
  ofisAdi?: string | undefined;
  admin?: boolean | undefined;
  /** Verilmezse rastgele üretilir ve bir kez gösterilir. */
  sifre?: string | undefined;
};

/** Okurken karışmasın diye 0/O, 1/l/I gibi karakterler yok. */
const SIFRE_KARAKTERLERI = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function rastgeleSifre(uzunluk = 14): string {
  return [...randomBytes(uzunluk)].map((b) => SIFRE_KARAKTERLERI[b % SIFRE_KARAKTERLERI.length]).join("");
}

/** Açık kayıt kapalı olduğu için hesaplar yalnızca buradan açılır. Ofis adıyla bulunur, yoksa oluşturulur. */
export async function kullaniciEkle(db: Veritabani, kimlik: Kimlik, girdi: KullaniciGirdisi) {
  const eposta = girdi.eposta.trim().toLowerCase();
  if (!girdi.admin && !girdi.ofisAdi?.trim()) throw new KullaniciHatasi("Admin olmayan kullanıcı için ofis adı gerekli (--ofis).");
  const sifre = girdi.sifre ?? rastgeleSifre();

  const ctx = await kimlik.$context;
  const { minPasswordLength } = ctx.password.config;
  if (sifre.length < minPasswordLength) throw new KullaniciHatasi(`Şifre en az ${minPasswordLength} karakter olmalı.`);
  if (await db.query.user.findFirst({ where: eq(user.email, eposta) })) {
    throw new KullaniciHatasi(`${eposta} adresiyle bir kullanıcı zaten var.`);
  }

  let ofisId: string | null = null;
  if (girdi.ofisAdi?.trim()) {
    const ad = girdi.ofisAdi.trim();
    const mevcut = await db.query.ofis.findFirst({ where: eq(ofis.ad, ad) });
    ofisId = mevcut?.id ?? (await db.insert(ofis).values({ ad }).returning({ id: ofis.id }))[0]!.id;
  }

  const yeni = await ctx.internalAdapter.createUser(
    { email: eposta, name: girdi.ad.trim(), ofisId, rol: girdi.admin ? "admin" : "uye" },
    { method: "admin" },
  );
  await ctx.internalAdapter.linkAccount({
    userId: yeni.id,
    providerId: "credential",
    accountId: yeni.id,
    password: await ctx.password.hash(sifre),
  });
  return { id: yeni.id, eposta, ofisId, sifre, sifreUretildi: !girdi.sifre };
}
