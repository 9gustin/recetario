import { redirect } from "next/navigation";
import { DEMO_GROUP_ID } from "@/components/shell/nav-items";

// Mientras no haya auth (T1.3), la raíz lleva al grupo de demo.
export default function Home() {
  redirect(`/g/${DEMO_GROUP_ID}/hoy`);
}
