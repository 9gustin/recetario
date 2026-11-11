import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Next 16 renombró `middleware` a `proxy`.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Excluye estáticos, íconos, manifest y el service worker (/serwist).
    "/((?!_next/static|_next/image|favicon.ico|serwist|manifest.webmanifest|icons|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
