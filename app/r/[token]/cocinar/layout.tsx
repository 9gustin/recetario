import { CookShell } from "@/components/cooking/cook-shell";

export default function PublicCookLayout({ children }: { children: React.ReactNode }) {
  return <CookShell>{children}</CookShell>;
}
