/** Kapanış kartında gösterilebilecek şirket bilgileri; hangilerinin görüneceğini şirket seçer. Tarayıcıda da kullanılır. */
export const KAPANIS_ALANLARI = ["web", "adres", "yetkili", "eposta"] as const;
export type KapanisAlani = (typeof KAPANIS_ALANLARI)[number];

export const KAPANIS_ALANI_ADLARI: Record<KapanisAlani, string> = { web: "Web adresi", adres: "Adres", yetkili: "Yetkili adı soyadı", eposta: "E-posta" };
