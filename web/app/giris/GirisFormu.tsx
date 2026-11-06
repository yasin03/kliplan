"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormSatiri } from "@/components/FormSatiri";
import { authClient } from "@/lib/auth-client";

const HATA_MESAJLARI: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "E-posta veya şifre hatalı.",
  TOO_MANY_REQUESTS: "Çok fazla deneme yapıldı. Birkaç dakika sonra tekrar deneyin.",
};

export function GirisFormu() {
  const router = useRouter();
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, setBekliyor] = useState(false);

  async function gonder(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setHata(null);
    setBekliyor(true);
    const { error } = await authClient.signIn.email({ email: String(form.get("eposta")), password: String(form.get("sifre")) });
    if (error) {
      setHata((error.code && HATA_MESAJLARI[error.code]) ?? "Giriş yapılamadı. Bağlantınızı kontrol edip tekrar deneyin.");
      setBekliyor(false);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-xl">Giriş yap</CardTitle>
        <CardDescription>Size verilen e-posta ve şifreyle giriş yapın.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={gonder} className="flex flex-col gap-4">
          <FormSatiri ad="eposta" etiket="E-posta">
            <Input id="eposta" name="eposta" type="email" autoComplete="email" required />
          </FormSatiri>
          <FormSatiri ad="sifre" etiket="Şifre">
            <Input id="sifre" name="sifre" type="password" autoComplete="current-password" required />
          </FormSatiri>
          {hata ? (
            <Alert variant="destructive">
              <AlertDescription>{hata}</AlertDescription>
            </Alert>
          ) : null}
          <Button type="submit" disabled={bekliyor}>
            {bekliyor ? "Giriş yapılıyor…" : "Giriş yap"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
