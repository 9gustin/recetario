import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { FoodProfileScreen } from "@/components/food-profile/food-profile-screen";
import { requireUser } from "@/lib/auth";
import { getProfileScreenData } from "@/lib/food-profile/queries";

export const metadata = { title: "Mi alimentación" };

export default async function Page() {
  const user = await requireUser();
  const data = await getProfileScreenData(user.id);
  return (
    <div className="flex flex-col gap-4 px-5 pt-2 pb-10">
      <Link
        href="/perfil"
        className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-accent"
      >
        <ChevronLeft className="size-4" aria-hidden="true" /> Perfil
      </Link>
      <h2 className="font-display text-[28px] leading-none font-normal">Mi alimentación</h2>
      <FoodProfileScreen initial={data} />
    </div>
  );
}
