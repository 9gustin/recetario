/** Se muestra al instante mientras carga la pantalla del grupo: la navegación se siente inmediata. */
export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-3 px-5 pt-3" aria-busy="true" aria-label="Cargando">
      <div className="h-8 w-2/3 animate-pulse rounded-xl bg-surface-2" />
      <div className="h-24 animate-pulse rounded-2xl bg-surface" />
      <div className="h-16 animate-pulse rounded-2xl bg-surface" />
      <div className="h-16 animate-pulse rounded-2xl bg-surface" />
    </div>
  );
}
