"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { Check, MessageSquare, PartyPopper, Pencil, Play, X } from "lucide-react";
import { PillButton } from "@/components/shared/pill-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  applyCookingEdits,
  summarizeEdits,
  type CookingEdit,
} from "@/lib/domain/apply-cooking-edits";
import { estimatedMinutes, ingredientsForStep } from "@/lib/domain/cooking-display";
import { resumeInit, type OpenSession } from "@/lib/domain/cooking-session";
import { useWakeLock } from "@/lib/hooks/use-wake-lock";
import type { ChatContext } from "@/lib/hooks/use-assistant-chat";
import Link from "next/link";
import type { RecipeDetail } from "@/lib/recipes/queries";
import { finishCookingSession, uploadCookingPhoto } from "@/lib/cooking/actions";
import { AskSheet } from "./ask-sheet";
import { EditStepSheet } from "./edit-step-sheet";
import { FinishScreen, type FinishPayload } from "./finish-screen";
import { MiseEnPlace } from "./mise-en-place";
import { ProgressSegments } from "./progress-segments";
import { StepCard } from "./step-card";
import { FloatingTimers } from "./timers/floating-timers";
import { remainingMs, useTimerStore } from "./timers/timer-store";
import { StepTimer } from "./timers/step-timer";
import { TimerEngine } from "./timers/timer-engine";
import { useCookingReducer } from "./use-cooking-reducer";
import { useSessionSync } from "./use-session-sync";

const SWIPE_DISTANCE = 70;

const slide = {
  enter: (dir: number) => ({ x: dir * 48, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir * -48, opacity: 0 }),
};

const WAKE_NOTICE_KEY = "recetario-wakelock-notice";

/** Avisa una sola vez (por dispositivo) que la pantalla se puede apagar. */
function noticeWakeLockUnsupported() {
  try {
    if (localStorage.getItem(WAKE_NOTICE_KEY) === "1") return;
    localStorage.setItem(WAKE_NOTICE_KEY, "1");
  } catch {
    // sin localStorage: se avisa igual
  }
  toast("Tu celular puede apagar la pantalla; subí el tiempo de bloqueo mientras cocinás.", {
    duration: 10_000,
  });
}

/** Lo que necesita el modo cocinar de una receta (sirve para la privada y para la pública). */
export type CookingRecipe = Pick<
  RecipeDetail,
  "id" | "title" | "servings" | "total_minutes" | "image_url" | "ingredients" | "steps"
>;

type Props = {
  /** Grupo de la receta; no se usa en modo público. */
  groupId: string;
  recipe: CookingRecipe;
  /**
   * Modo privado (default): crea sesión, guarda el progreso, permite ajustar y terminar con nota.
   * Modo público (`/r/[token]/cocinar`): sin sesión ni edición; al terminar invita a guardar la receta.
   */
  persist?: boolean;
  /** A dónde vuelve ✕ y "Volver a la receta" (default: el detalle de la receta en el grupo). */
  exitHref?: string;
  /** Solo modo público: link para guardar la receta en el recetario propio. */
  saveHref?: string;
  /** Sesión a medias de esta persona (ya validada: reciente y sin terminar). */
  resume?: OpenSession | null;
};

/** Modo cocinar tipo historias: un paso por pantalla, con tap y swipe para navegar. */
export function CookingStories({
  groupId,
  recipe,
  resume = null,
  persist = true,
  exitHref,
  saveHref,
}: Props) {
  const leaveHref = exitHref ?? `/g/${groupId}/recetas/${recipe.id}`;
  const router = useRouter();
  const [edits, setEdits] = useState<CookingEdit[]>(resume?.pending_edits ?? []);
  // La receta con los ajustes de esta sesión ya aplicados (la original no se toca hasta el final).
  const effective = useMemo(
    () => applyCookingEdits({ ingredients: recipe.ingredients, steps: recipe.steps }, edits),
    [recipe.ingredients, recipe.steps, edits],
  );
  const steps = effective.steps;
  const [state, dispatch] = useCookingReducer(
    resume ? resumeInit(resume, steps.length) : { steps: steps.length, servings: recipe.servings },
  );
  const [editOpen, setEditOpen] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(() =>
    resume ? new Date(resume.started_at).getTime() : null,
  );
  const [askResume, setAskResume] = useState(resume !== null);
  const sync = useSessionSync({
    recipeId: recipe.id,
    initialSessionId: resume?.id ?? null,
    index: state.index,
    servings: state.servings,
    edits,
  });
  const [exitOpen, setExitOpen] = useState(false);
  const dragged = useRef(false);
  useWakeLock({ onUnsupported: noticeWakeLockUnsupported });

  const isMise = state.index === 0;
  const isFinal = state.index === state.total - 1;
  const stepIndex = state.index - 1;
  const step = isMise || isFinal ? null : steps[stepIndex];

  // Teclas ← → en desktop.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") dispatch({ type: "NEXT" });
      if (e.key === "ArrowLeft") dispatch({ type: "PREV" });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dispatch]);

  const goToStep = useCallback(
    (stepIdx: number) => dispatch({ type: "GOTO", index: stepIdx + 1 }),
    [dispatch],
  );

  function advance() {
    dispatch({ type: "COMPLETE" });
    dispatch({ type: "NEXT" });
  }

  /** Estado de la sesión para el asistente: receta, pantalla actual, porciones y timers de esta receta. */
  function assistantContext(): ChatContext {
    const now = Date.now();
    const timers = Object.values(useTimerStore.getState().timers)
      .filter((t) => t.recipeId === recipe.id && t.status !== "done")
      .map((t) => ({ label: t.label, remaining_seconds: Math.ceil(remainingMs(t, now) / 1000) }));
    return {
      origin: "cooking",
      recipeId: recipe.id,
      step: state.index,
      servings: state.servings,
      timers,
    };
  }

  function applyEdits(ops: CookingEdit[]) {
    const next = [...edits, ...ops];
    setEdits(next);
    dispatch({
      type: "SET_STEPS",
      steps: applyCookingEdits({ ingredients: recipe.ingredients, steps: recipe.steps }, next).steps
        .length,
    });
  }

  async function finish(payload: FinishPayload) {
    const sessionId = await sync.ensureSession();
    if (!sessionId) {
      toast.error("No pudimos guardar la sesión. Revisá tu conexión y probá de nuevo.");
      return;
    }
    let photoUrl: string | undefined;
    if (payload.photo) {
      const form = new FormData();
      form.set("groupId", groupId);
      form.set("recipeId", recipe.id);
      form.set("file", payload.photo);
      const uploaded = await uploadCookingPhoto(form);
      if (uploaded.ok) photoUrl = uploaded.data.url;
      else toast.error(uploaded.error);
    }
    const res = await finishCookingSession({
      sessionId,
      rating: payload.rating,
      note: payload.note,
      photoUrl,
      useAsCover: payload.useAsCover,
      saveToRecipe: payload.saveToRecipe,
      edits,
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(res.data.savedVersion ? "Guardamos los cambios en la receta" : "¡Buen provecho!");
    router.push(`/g/${groupId}/recetas/${recipe.id}`);
    router.refresh();
  }

  function start() {
    setStartedAt(Date.now());
    if (persist) sync.begin();
    advance();
  }

  function startOver() {
    sync.discard();
    dispatch({ type: "RESET", servings: recipe.servings });
    setAskResume(false);
  }

  function onDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.x <= -SWIPE_DISTANCE) dispatch({ type: "NEXT" });
    else if (info.offset.x >= SWIPE_DISTANCE) dispatch({ type: "PREV" });
    // El click que sigue a un arrastre no debe contar como tap en una zona.
    setTimeout(() => (dragged.current = false), 0);
  }

  function tapZone(action: "NEXT" | "PREV") {
    if (dragged.current) return;
    dispatch({ type: action });
  }

  return (
    <div className="flex h-full flex-col gap-[18px] px-[18px] pt-3.5 pb-[22px]">
      <ProgressSegments total={state.total} index={state.index} completed={state.completed} />

      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-muted">{recipe.title}</p>
          <p className="mt-0.5 text-[15px] font-bold">
            {isMise
              ? "Mise en place"
              : isFinal
                ? "Terminaste"
                : `Paso ${stepIndex + 1} de ${steps.length}`}
          </p>
        </div>
        <div className="flex flex-none gap-2">
          {step && persist ? (
            <button
              type="button"
              aria-label="Preguntar sobre este paso"
              onClick={() => setAskOpen(true)}
              className="flex size-11 items-center justify-center rounded-full bg-surface"
            >
              <MessageSquare className="size-5" aria-hidden="true" />
            </button>
          ) : null}
          {step && persist ? (
            <button
              type="button"
              aria-label="Ajustar este paso"
              onClick={() => setEditOpen(true)}
              className="flex size-11 items-center justify-center rounded-full bg-surface"
            >
              <Pencil className="size-5" aria-hidden="true" />
            </button>
          ) : null}
          <button
            type="button"
            aria-label="Salir del modo cocinar"
            onClick={() => setExitOpen(true)}
            className="flex size-11 flex-none items-center justify-center rounded-full bg-surface"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
      </header>

      <TimerEngine onGoToStep={goToStep} />
      <FloatingTimers
        recipeId={recipe.id}
        currentStepIndex={step ? stepIndex : null}
        onGoToStep={goToStep}
      />

      <div className="relative min-h-0 flex-1">
        {step ? (
          <motion.div
            className="absolute inset-0 z-0"
            drag="x"
            dragSnapToOrigin
            dragElastic={0.12}
            onDragStart={() => (dragged.current = true)}
            onDragEnd={onDragEnd}
          >
            <button
              type="button"
              aria-label="Paso anterior"
              onClick={() => tapZone("PREV")}
              className="absolute inset-y-0 left-0 w-1/3"
            />
            <button
              type="button"
              aria-label="Paso siguiente"
              onClick={() => tapZone("NEXT")}
              className="absolute inset-y-0 right-0 w-1/3"
            />
          </motion.div>
        ) : null}

        <AnimatePresence mode="wait" custom={state.direction} initial={false}>
          <motion.div
            key={state.index}
            custom={state.direction}
            variants={slide}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.18, ease: "easeOut" }}
            className={
              step
                ? "pointer-events-none relative z-10 h-full overflow-hidden [&_a]:pointer-events-auto [&_button]:pointer-events-auto"
                : "relative z-10 h-full"
            }
          >
            {isMise ? (
              <MiseEnPlace
                title={recipe.title}
                ingredients={effective.ingredients}
                baseServings={recipe.servings}
                servings={state.servings}
                onServingsChange={(servings) => dispatch({ type: "SET_SERVINGS", servings })}
                minutes={estimatedMinutes(recipe, steps)}
              />
            ) : step ? (
              <StepCard
                instruction={step.instruction}
                tip={step.tip}
                durationSeconds={step.duration_seconds}
                ingredients={ingredientsForStep(step, effective.ingredients)}
                baseServings={recipe.servings}
                servings={state.servings}
                timerCard={
                  step.duration_seconds ? (
                    <StepTimer
                      recipeId={recipe.id}
                      stepIndex={stepIndex}
                      durationSeconds={step.duration_seconds}
                      passive={step.timer_kind === "passive"}
                    />
                  ) : undefined
                }
              />
            ) : persist ? (
              <FinishScreen
                recipeTitle={recipe.title}
                startedAt={startedAt}
                changes={summarizeEdits(
                  { ingredients: recipe.ingredients, steps: recipe.steps },
                  edits,
                )}
                recipeHasPhoto={Boolean(recipe.image_url)}
                onFinish={finish}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                <PartyPopper className="size-14 text-accent" aria-hidden="true" />
                <h1 className="font-display text-[33px] leading-[1.1] font-normal">¡Listo!</h1>
                <p className="max-w-[260px] text-sm text-muted">
                  Terminaste {recipe.title}. ¿Te gustó? Guardala en tu recetario para tenerla
                  siempre.
                </p>
                {saveHref ? (
                  <PillButton asChild>
                    <Link href={saveHref}>Guardar en mi recetario</Link>
                  </PillButton>
                ) : null}
                <PillButton variant="outline" size="md" onClick={() => router.push(leaveHref)}>
                  Volver a la receta
                </PillButton>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex gap-2.5">
        {isMise ? (
          <PillButton className="min-h-[60px] flex-1 text-lg" onClick={start}>
            <Play fill="currentColor" /> Empezar
          </PillButton>
        ) : isFinal ? null : (
          <PillButton className="min-h-[60px] flex-1 text-lg" onClick={advance}>
            Listo <Check />
          </PillButton>
        )}
      </div>

      {persist ? (
        <AskSheet
          open={askOpen && Boolean(step)}
          onOpenChange={setAskOpen}
          groupId={groupId}
          stepLabel={
            step
              ? `Paso ${stepIndex + 1} · ${step.instruction.split(/\s+/).slice(0, 4).join(" ")}…`
              : "Receta"
          }
          getContext={assistantContext}
          onApplyInSession={(proposal) => applyEdits(proposal.ops)}
        />
      ) : null}

      {step && persist ? (
        <EditStepSheet
          open={editOpen}
          onOpenChange={setEditOpen}
          stepIndex={stepIndex}
          step={step}
          stepCount={steps.length}
          ingredients={ingredientsForStep(step, effective.ingredients).map((ingredient) => ({
            ingredient,
            index: effective.ingredients.findIndex((i) => i.id === ingredient.id),
          }))}
          baseServings={recipe.servings}
          servings={state.servings}
          onApply={applyEdits}
        />
      ) : null}

      <Dialog open={askResume}>
        <DialogContent showCloseButton={false} onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Seguís en el paso {state.index}</DialogTitle>
            <DialogDescription>
              Dejaste esta receta a medias. ¿Continuás donde estabas o empezás de nuevo?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <PillButton variant="outline" size="md" onClick={startOver}>
              Empezar de nuevo
            </PillButton>
            <PillButton size="md" onClick={() => setAskResume(false)}>
              Continuar
            </PillButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={exitOpen} onOpenChange={setExitOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Salir?</DialogTitle>
            <DialogDescription>Tu progreso queda guardado.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <PillButton variant="outline" size="md" onClick={() => setExitOpen(false)}>
              Seguir cocinando
            </PillButton>
            <PillButton size="md" onClick={() => router.push(leaveHref)}>
              Salir
            </PillButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
