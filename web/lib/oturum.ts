import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { yetkiOlustur } from "@cekirdek/veri/yetki.js";
import { auth, depoAl } from "./auth";

export async function oturumuAl() {
  return auth.api.getSession({ headers: await headers() });
}

/**
 * Korunan her sayfa ve eylem bunu çağırır; proxy'deki çerez kontrolü tek başına güvenli değildir.
 * Dönen `depo` yalnızca kullanıcının ofisine ait verileri görür.
 */
export async function girisGerekli() {
  const oturum = await oturumuAl();
  if (!oturum) redirect("/giris");
  const yetki = yetkiOlustur(oturum.user);
  const depo = depoAl(yetki);
  return { kullanici: oturum.user, yetki, depo, ofis: await depo.ofis() };
}
