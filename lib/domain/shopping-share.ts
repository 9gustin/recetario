import { formatPurchaseQuantity } from "./shopping-list";

export type ShareItem = {
  display_name: string;
  quantity: number | null;
  unit: string | null;
  purchase_hint: string | null;
  aisle: string;
  state: string;
  no_longer_needed: boolean;
};

const AISLE_LABELS: Record<string, string> = {
  verduleria: "Verdulería",
  carniceria: "Carnicería",
  pescaderia: "Pescadería",
  fiambreria: "Fiambrería",
  lacteos: "Lácteos",
  panaderia: "Panadería",
  almacen: "Almacén",
  congelados: "Congelados",
  bebidas: "Bebidas",
  limpieza: "Limpieza",
  otros: "Otros",
};
export const aisleLabel = (a: string) => AISLE_LABELS[a] ?? a.charAt(0).toUpperCase() + a.slice(1);

/** Texto para mandar por WhatsApp: agrupado por sección, solo lo pendiente. */
export function shareAsText(name: string, items: ShareItem[]): string {
  const pending = items.filter((i) => i.state === "pending" && !i.no_longer_needed);
  const bySection = new Map<string, ShareItem[]>();
  for (const i of pending) bySection.set(i.aisle, [...(bySection.get(i.aisle) ?? []), i]);
  const blocks = [...bySection.entries()].map(([aisle, list]) =>
    [
      `*${aisleLabel(aisle)}*`,
      ...list.map((i) => {
        const qty = i.purchase_hint || formatPurchaseQuantity(i.quantity, i.unit);
        return `- ${i.display_name}${qty ? ` (${qty})` : ""}`;
      }),
    ].join("\n"),
  );
  return [`🛒 ${name}`, ...blocks].join("\n\n");
}
