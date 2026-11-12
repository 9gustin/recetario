import "server-only";
import { cookies } from "next/headers";

/**
 * "Ahora" para el servidor. Solo en los tests e2e (E2E_TIME_OVERRIDE=1) se puede fijar con la
 * cookie `e2e-now`; en producción esa variable no existe y siempre es la hora real.
 */
export async function getNow(): Promise<Date> {
  if (process.env.E2E_TIME_OVERRIDE === "1") {
    const value = (await cookies()).get("e2e-now")?.value;
    const date = value ? new Date(value) : null;
    if (date && !Number.isNaN(date.getTime())) return date;
  }
  return new Date();
}
