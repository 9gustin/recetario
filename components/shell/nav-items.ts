import { Book, Calendar, ShoppingBag, Sun, User, type LucideIcon } from "lucide-react";

export type NavItem = {
  key: "hoy" | "recetas" | "plan" | "compras" | "perfil";
  label: string;
  icon: LucideIcon;
  href: (groupId: string) => string;
};

export const NAV_ITEMS: NavItem[] = [
  { key: "hoy", label: "Hoy", icon: Sun, href: (g) => `/g/${g}/hoy` },
  { key: "recetas", label: "Recetas", icon: Book, href: (g) => `/g/${g}/recetas` },
  { key: "plan", label: "Plan", icon: Calendar, href: (g) => `/g/${g}/plan` },
  { key: "compras", label: "Compras", icon: ShoppingBag, href: (g) => `/g/${g}/compras` },
  { key: "perfil", label: "Perfil", icon: User, href: () => "/perfil" },
];
