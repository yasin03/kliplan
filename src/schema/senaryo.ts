import { z } from "zod";

/**
 * Yapay zekanın döndürmesi gereken yapı. Kısıtlar (uzunluk, kelime sayısı vb.) burada değil,
 * anlaşılır hata mesajları üretebilmek için senaryo doğrulamasında kontrol edilir.
 */
export const yzSenaryoSemasi = z.object({
  sahneler: z.array(
    z.object({
      fotograf: z.string().describe("Sahnede gösterilecek fotoğrafın dosya adı, listeden birebir"),
      baslik: z.string().describe("Ekranda büyük yazılacak kısa başlık"),
      disSes: z.string().describe("Bu sahnede seslendirilecek metin"),
      ekranMetni: z.string().describe("Altta sahne boyunca sabit duracak, dış sesi tekrar etmeyen kısa metin"),
    }),
  ),
});

export type YzSenaryo = z.infer<typeof yzSenaryoSemasi>;
