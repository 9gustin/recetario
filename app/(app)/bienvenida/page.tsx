import { redirect } from "next/navigation";
import { Welcome } from "@/components/onboarding/welcome";
import { requireUser } from "@/lib/auth";
import { getOnboardingState } from "@/lib/onboarding/queries";

export const metadata = { title: "Bienvenida" };

export default async function Page() {
  const user = await requireUser();
  const state = await getOnboardingState(user.id);
  if (!state.personalGroupId) redirect("/grupos");
  return (
    <Welcome
      personalGroupId={state.personalGroupId}
      done={[state.hasGroup, state.hasRecipe, state.hasProfile]}
    />
  );
}
