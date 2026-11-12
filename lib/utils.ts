import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Solo permite redirecciones a rutas internas (evita open redirect). */
export function safeRedirect(path: string | null | undefined, fallback = "/") {
  if (path && path.startsWith("/") && !path.startsWith("//")) return path;
  return fallback;
}
