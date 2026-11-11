import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  /** Texto chico arriba a la izquierda (ej. "Miércoles 11 · Casa"). */
  meta?: ReactNode;
  /** Elemento arriba a la derecha (ej. botón "Preguntar" o la hora). */
  topRight?: ReactNode;
  /** Ilustración o foto de la receta: ocupa todo el bloque, detrás del contenido. */
  image?: ReactNode;
  /** Línea en mayúsculas sobre el título (ej. "ESTA NOCHE"). */
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Contenido extra entre el título y el botón (ej. un buscador). */
  children?: ReactNode;
  /** El único botón principal de la pantalla: un <PillButton>. */
  action?: ReactNode;
  className?: string;
};

/** Bloque grande de color (--hero) con slot de imagen, título serif y un botón principal. */
export function Hero({
  meta,
  topRight,
  image,
  eyebrow,
  title,
  subtitle,
  children,
  action,
  className,
}: Props) {
  return (
    <section
      className={cn(
        "relative flex min-h-[340px] flex-none flex-col justify-between gap-5 overflow-hidden bg-hero p-5 text-foreground",
        className,
      )}
    >
      {image ? (
        <div aria-hidden="true" className="absolute inset-0 [&>img]:size-full [&>img]:object-cover">
          {image}
        </div>
      ) : null}

      {meta || topRight ? (
        <div className="relative flex min-h-11 items-center justify-between gap-3">
          <p className="text-[13px] font-semibold text-foreground/80">{meta}</p>
          {topRight}
        </div>
      ) : null}

      <div className="relative flex flex-col gap-3.5">
        <div>
          {eyebrow ? (
            <p className="text-[13px] font-bold tracking-[0.1em] text-foreground uppercase">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="mt-1.5 font-display text-[40px] leading-[1.02] font-normal text-balance">
            {title}
          </h1>
          {subtitle ? <p className="mt-2.5 text-sm text-foreground/80">{subtitle}</p> : null}
        </div>
        {children}
        {action}
      </div>
    </section>
  );
}
