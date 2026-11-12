"use client";

import { useRef, useState } from "react";
import { FileUp, Loader2, PenLine } from "lucide-react";
import { PillButton } from "@/components/shared/pill-button";
import { Textarea } from "@/components/ui/textarea";
import { VoiceRecorder } from "@/components/voice/voice-recorder";
import { createClient } from "@/lib/supabase/client";

export type IntakePayload = { text?: string; transcript?: string; filePaths?: string[] };

type Props = {
  /** Si ya hay perfil, el texto cambia a "Contame algo más". */
  hasProfile: boolean;
  onSubmit: (payload: IntakePayload) => void;
  onCancel?: () => void;
  error?: string | null;
};

type Mode = "voice" | "text";

/** Entrada del perfil: hablar, escribir o subir el plan de la nutricionista. */
export function Intake({ hasProfile, onSubmit, onCancel, error }: Props) {
  const [mode, setMode] = useState<Mode>("voice");
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setUploadError(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Tenés que iniciar sesión.");
      const paths: string[] = [];
      for (const file of Array.from(files).slice(0, 3)) {
        const ext = (file.name.split(".").pop() || "bin")
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "")
          .slice(0, 5);
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upError } = await supabase.storage
          .from("profile-inputs")
          .upload(path, file, { contentType: file.type });
        if (upError) throw new Error("No pudimos subir el archivo. Probá de nuevo.");
        paths.push(path);
      }
      onSubmit({ filePaths: paths });
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "No pudimos subir el archivo.");
    } finally {
      setUploading(false);
    }
  }

  const message = error ?? uploadError;

  return (
    <section
      className="flex flex-col gap-4 rounded-[22px] bg-hero p-4"
      aria-label="Contar cómo comés"
    >
      <div>
        <p className="text-base font-semibold">
          {hasProfile ? "Contame algo más" : "Contame cómo comés"}
        </p>
        <p className="mt-1 text-[13px] leading-[1.4] text-foreground/80">
          Qué te gusta, qué no podés comer, si seguís algún plan. Hablá, escribí o subí el plan de
          tu nutricionista.
        </p>
      </div>

      {mode === "voice" ? (
        <VoiceRecorder
          idleLabel="Tocá y contame"
          confirmLabel="Armar mi perfil"
          onTranscript={(transcript) => onSubmit({ transcript })}
        />
      ) : (
        <div className="flex flex-col gap-2">
          <label htmlFor="profile-text" className="sr-only">
            Contanos cómo comés
          </label>
          <Textarea
            id="profile-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ej.: No puedo comer cebolla, trato de evitar las harinas a la noche, me gusta el pescado…"
            className="min-h-32 bg-background text-base"
          />
          <PillButton
            disabled={text.trim().length < 5}
            onClick={() => onSubmit({ text: text.trim() })}
          >
            Armar mi perfil
          </PillButton>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <PillButton
          variant="inverse"
          size="md"
          onClick={() => setMode(mode === "voice" ? "text" : "voice")}
        >
          <PenLine /> {mode === "voice" ? "Prefiero escribir" : "Prefiero hablar"}
        </PillButton>
        <input
          ref={fileInput}
          type="file"
          accept="application/pdf,image/*"
          multiple
          className="sr-only"
          aria-label="Subir el plan (PDF o foto)"
          onChange={(e) => void onFiles(e.target.files)}
        />
        <PillButton
          variant="inverse"
          size="md"
          disabled={uploading}
          onClick={() => fileInput.current?.click()}
        >
          {uploading ? <Loader2 className="animate-spin" /> : <FileUp />} Subir archivo
        </PillButton>
        {onCancel ? (
          <PillButton variant="outline" size="md" onClick={onCancel}>
            Cancelar
          </PillButton>
        ) : null}
      </div>

      {message ? (
        <p role="alert" className="text-sm text-danger-soft">
          {message}
        </p>
      ) : null}
    </section>
  );
}
