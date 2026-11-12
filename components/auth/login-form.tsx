"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BRAND } from "@/lib/brand";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PillButton } from "@/components/shared/pill-button";
import { cn } from "@/lib/utils";

type Mode = "signin" | "signup";

const inputClass =
  "min-h-[54px] rounded-2xl border-border bg-surface px-4 text-base placeholder:text-muted";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function switchMode(m: Mode) {
    setMode(m);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (mode === "signup" && !name.trim()) {
      setError("Contanos tu nombre.");
      return;
    }
    if (!email.includes("@")) {
      setError("Revisá el email.");
      return;
    }
    if (password.length < 6) {
      setError("La contraseña tiene que tener al menos 6 caracteres.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    if (mode === "signin") {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError("Email o contraseña incorrectos.");
        setLoading(false);
        return;
      }
    } else {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: name.trim() } },
      });
      if (signUpError) {
        setError(
          signUpError.message.toLowerCase().includes("registered")
            ? "Ese email ya está registrado."
            : "No pudimos crear tu cuenta. Probá de nuevo.",
        );
        setLoading(false);
        return;
      }
    }

    router.push(next.startsWith("/") && !next.startsWith("//") ? next : "/");
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background">
      <section className="bg-hero px-5 pt-[calc(env(safe-area-inset-top)+28px)] pb-6 text-foreground">
        <p className="text-[13px] font-bold tracking-[0.1em] text-foreground/80 uppercase">
          {BRAND.name}
        </p>
        <h1 className="mt-2 font-display text-[40px] leading-[1.02] font-normal">
          {BRAND.tagline}
        </h1>
        <p className="mt-2 max-w-[280px] text-sm text-foreground/80">
          Tus recetas, el plan de la semana y la compra, todo en un solo lugar.
        </p>
      </section>

      <div className="flex flex-1 flex-col gap-4 px-5 py-6">
        <div className="grid grid-cols-2 gap-1 rounded-full bg-surface-2 p-1">
          {(
            [
              ["signin", "Entrar"],
              ["signup", "Crear cuenta"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => switchMode(value)}
              className={cn(
                "min-h-11 rounded-full text-sm font-semibold transition-colors",
                mode === value ? "bg-background text-foreground" : "text-muted",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          {mode === "signup" ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Tu nombre</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Agus"
                autoComplete="name"
                className={inputClass}
              />
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vos@email.com"
              autoComplete="email"
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Al menos 6 caracteres"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              className={inputClass}
            />
          </div>

          {error ? (
            <p role="alert" className="text-sm font-medium text-danger-soft">
              {error}
            </p>
          ) : null}

          <PillButton type="submit" fullWidth disabled={loading}>
            {loading ? "Esperá…" : mode === "signin" ? "Entrar" : "Crear cuenta"}
          </PillButton>
        </form>
      </div>
    </div>
  );
}
