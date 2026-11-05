import { eq, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { KUTUPHANE_ONEKI, ofisOneki } from "../depolama/Depolama.js";

/** Bulunamayan ve erişim izni olmayan kayıt aynı hatayı verir; başka ofisin kaydının varlığı sızmaz. */
export class BulunamadiHatasi extends Error {}
export class ErisimHatasi extends Error {}

/** Oturumdan türetilen erişim bilgisi. Veri katmanındaki her fonksiyon bunu ister. */
export type Yetki = {
  kullaniciId: string;
  /** Admin hesabında boş olabilir. */
  ofisId: string | null;
  admin: boolean;
};

export function yetkiOlustur(kullanici: { id: string; ofisId?: string | null | undefined; rol?: string | null | undefined }): Yetki {
  return { kullaniciId: kullanici.id, ofisId: kullanici.ofisId ?? null, admin: kullanici.rol === "admin" };
}

/** Sorgu koşulu: admin için yok (hepsi), üye için yalnızca kendi ofisi. */
export function ofisKosulu(yetki: Yetki, sutun: PgColumn): SQL | undefined {
  if (yetki.admin) return undefined;
  if (!yetki.ofisId) throw new ErisimHatasi("Hesabınız bir şirkete bağlı değil. Yöneticiyle iletişime geçin.");
  return eq(sutun, yetki.ofisId);
}

/** Yeni kaydın ofisi: üye için her zaman kendi ofisi; admin bir ofis belirtmek zorunda. */
export function hedefOfis(yetki: Yetki, istenen?: string): string {
  if (!yetki.admin) {
    if (!yetki.ofisId) throw new ErisimHatasi("Hesabınız bir şirkete bağlı değil. Yöneticiyle iletişime geçin.");
    if (istenen && istenen !== yetki.ofisId) throw new ErisimHatasi("Başka bir şirket adına kayıt oluşturamazsınız.");
    return yetki.ofisId;
  }
  if (!istenen) throw new ErisimHatasi("Admin olarak kayıt oluştururken ofis seçilmeli.");
  return istenen;
}

/** Dosya anahtarı bu kullanıcının ofisine mi ait? Hazır müzik kütüphanesini herkes dinleyebilir. */
export function dosyayaErisebilirMi(yetki: Yetki, anahtar: string): boolean {
  if (yetki.admin || anahtar.startsWith(KUTUPHANE_ONEKI)) return true;
  return Boolean(yetki.ofisId) && anahtar.startsWith(ofisOneki(yetki.ofisId!));
}
