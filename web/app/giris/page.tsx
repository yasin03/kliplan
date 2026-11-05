import { redirect } from "next/navigation";
import { oturumuAl } from "@/lib/oturum";
import { GirisFormu } from "./GirisFormu";

export default async function GirisSayfasi() {
  if (await oturumuAl()) redirect("/");
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted p-4">
      <GirisFormu />
    </main>
  );
}
