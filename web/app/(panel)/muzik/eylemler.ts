"use server";

import { refresh } from "next/cache";
import { kullaniciMesaji } from "@/lib/hatalar";
import { girisGerekli } from "@/lib/oturum";

export async function muzikSil(muzikId: string): Promise<{ hata: string | null }> {
  const { depo } = await girisGerekli();
  try {
    await depo.muzikSil(muzikId);
  } catch (hata) {
    const mesaj = kullaniciMesaji(hata);
    if (!mesaj) throw hata;
    return { hata: mesaj };
  }
  refresh();
  return { hata: null };
}
