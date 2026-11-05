import Link from "next/link";
import { girisGerekli } from "@/lib/oturum";
import { CikisButonu } from "./CikisButonu";

const MENU = [
  { href: "/", ad: "İlanlar" },
  { href: "/ayarlar", ad: "Şirket ayarları" },
  { href: "/muzik", ad: "Müzik" },
];

export default async function PanelDuzeni({ children }: { children: React.ReactNode }) {
  const { kullanici, ofis, yetki } = await girisGerekli();
  return (
    <div className="min-h-svh bg-muted">
      <header className="border-b bg-background">
        <div className="mx-auto flex min-h-14 max-w-5xl flex-wrap items-center justify-between gap-x-4 px-4 py-2">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="font-semibold">{ofis?.ad ?? (yetki.admin ? "Yönetici" : "Şirket atanmamış")}</span>
            <nav className="flex gap-1 text-sm">
              {MENU.map((m) => (
                <Link key={m.href} href={m.href} className="rounded-md px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                  {m.ad}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>{kullanici.name}</span>
            <CikisButonu />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl p-4">{children}</main>
    </div>
  );
}
