"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

/** Muestra el toast de bienvenida cuando venís de aceptar una invitación (?joined=Nombre). */
export function JoinToast() {
  const searchParams = useSearchParams();
  const joined = searchParams.get("joined");

  useEffect(() => {
    if (joined) toast.success(`¡Te uniste a ${joined}!`);
  }, [joined]);

  return null;
}
