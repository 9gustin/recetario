import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, Send, Eye } from "lucide-react";
import { PillButton } from "@/components/shared/pill-button";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Para nutricionistas",
  description: `Armá planes con objetivos, enviáselos a tus pacientes y seguí cómo comen, con su permiso. ${BRAND.name}.`,
};

const POINTS = [
  {
    icon: ClipboardList,
    title: "Planes con objetivos",
    text: "Armalos con recetas del catálogo o con tus propias comidas, y guardalos como plantilla.",
  },
  {
    icon: Send,
    title: "Enviá sin pisar nada",
    text: "Tu paciente recibe el plan o un grupo de recetas y elige qué sumar a su listado. Nunca le pisamos lo suyo.",
  },
  {
    icon: Eye,
    title: "Seguimiento con permiso",
    text: "Si tu paciente lo autoriza, ves qué comió y si cargó o no. Puede dejar de compartir cuando quiera.",
  },
];

/** Landing para nutricionistas invitados (se entra con un código). */
export default function Page() {
  return (
    <div className="flex flex-1 flex-col gap-8 px-5 py-8">
      <header className="flex flex-col gap-3">
        <p className="text-xs font-bold tracking-wide text-accent uppercase">Para nutricionistas</p>
        <h1 className="font-display text-[34px] leading-[1.05] font-normal">
          Tus planes, en la cocina de tus pacientes
        </h1>
        <p className="text-[15px] text-muted">
          Estamos abriendo {BRAND.name} a profesionales por invitación. Si tenés un código,
          registrate y empezá a armar y compartir planes.
        </p>
        <div className="flex flex-col gap-2 pt-1">
          <PillButton asChild fullWidth>
            <Link href="/login?next=/pro/registro">Tengo un código</Link>
          </PillButton>
          <p className="text-center text-xs text-muted">
            ¿Todavía no tenés código? Escribinos y te invitamos.
          </p>
        </div>
      </header>
      <ul className="flex flex-col gap-3">
        {POINTS.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex gap-3 rounded-[20px] border border-border bg-surface p-4">
            <span className="flex size-11 flex-none items-center justify-center rounded-full bg-hero">
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-[15px] font-bold">{title}</h2>
              <p className="text-sm text-muted">{text}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="text-center text-xs text-muted">
        Herramienta de apoyo: no reemplaza el criterio profesional.
      </p>
    </div>
  );
}
