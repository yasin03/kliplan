import { girisGerekli } from "@/lib/oturum";
import { CikisButonu } from "./CikisButonu";

export default async function PanelDuzeni({ children }: { children: React.ReactNode }) {
  const { kullanici, ofis, yetki } = await girisGerekli();
  return (
    <div className="min-h-svh bg-muted">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <span className="font-semibold">{ofis?.ad ?? (yetki.admin ? "Yönetici" : "Ofis atanmamış")}</span>
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
