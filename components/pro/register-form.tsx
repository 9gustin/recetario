"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PillButton } from "@/components/shared/pill-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { redeemCode } from "@/lib/pro/actions";

export function RegisterForm({ defaultName }: { defaultName: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const res = await redeemCode({
        code: f.get("code"),
        name: f.get("name"),
        license: f.get("license") || undefined,
        bio: f.get("bio") || undefined,
      });
      if (!res.ok) return setError(res.error);
      router.push("/pro");
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 px-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="code">Código de invitación</Label>
        <Input id="code" name="code" required autoCapitalize="characters" autoComplete="off" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Tu nombre profesional</Label>
        <Input
          id="name"
          name="name"
          required
          defaultValue={defaultName}
          placeholder="Lic. Ana Pérez"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="license">Matrícula (opcional)</Label>
        <Input id="license" name="license" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="bio">Presentación breve (opcional)</Label>
        <Textarea id="bio" name="bio" rows={3} maxLength={500} />
      </div>
      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
      <PillButton type="submit" fullWidth disabled={pending}>
        Activar mi cuenta profesional
      </PillButton>
    </form>
  );
}
