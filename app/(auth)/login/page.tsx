import { LoginForm } from "@/components/auth/login-form";

export const metadata = { title: "Entrar" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return <LoginForm next={next ?? "/"} />;
}
