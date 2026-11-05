import { veritabaniCalisiyor } from "@/lib/auth";

/** Sunucuda konteyner sağlık kontrolü ve dış izleme için. Oturum gerektirmez, ayrıntı vermez. */
export async function GET() {
  const tamam = await veritabaniCalisiyor();
  return Response.json({ durum: tamam ? "tamam" : "veritabanı yok" }, { status: tamam ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
