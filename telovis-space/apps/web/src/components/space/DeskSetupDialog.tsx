"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  CHAIR_COLORS,
  CHAIR_MODELS,
  DESK_MODELS,
  DESK_SCREENS,
  DESK_SURFACE_NAMES,
  DESK_SURFACES,
  SCREEN_COLOR_NAMES,
  SCREEN_COLORS,
  type DeskSetup,
} from "@telovis/protocol";
import { releaseDesk, updateDeskSetup } from "@/app/space/desk-actions";
import { DESK_TEX_H, DESK_W, drawDesk } from "@/game/desk-draw";

const TOGGLES: { field: "plant" | "mug" | "lamp"; label: string }[] = [
  { field: "plant", label: "Planta" },
  { field: "mug", label: "Caneca" },
  { field: "lamp", label: "Luminária" },
];

function DeskPreview({ setup }: { setup: DeskSetup }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const src = document.createElement("canvas");
    src.width = DESK_W;
    src.height = DESK_TEX_H;
    drawDesk(src.getContext("2d")!, setup, true);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  }, [setup]);
  return (
    <canvas
      ref={ref}
      width={DESK_W * 4}
      height={DESK_TEX_H * 4}
      role="img"
      aria-label="Prévia da sua mesa"
      className="max-w-full"
    />
  );
}

/** Índice de "Em pé" em DESK_MODELS: mesa sem cadeira. */
const STANDING_MODEL = DESK_MODELS.indexOf("Em pé");

const choiceClass = (active: boolean) =>
  `rounded-lg border px-3 py-1.5 text-sm ${
    active
      ? "border-emerald-500 bg-emerald-500/10 text-emerald-300"
      : "border-slate-700 hover:border-slate-500"
  }`;

/**
 * Diálogo para montar o setup da própria mesa. `data-game-modal` faz a cena
 * ignorar WASD enquanto ele está aberto.
 */
export default function DeskSetupDialog({
  spaceId,
  initial,
  onClose,
  onError,
}: {
  spaceId: string;
  initial: DeskSetup;
  onClose: () => void;
  onError: (message: string) => void;
}) {
  const [setup, setSetup] = useState(initial);
  const [pending, startTransition] = useTransition();
  const firstButton = useRef<HTMLButtonElement>(null);
  const set = <K extends keyof DeskSetup>(field: K, value: DeskSetup[K]) =>
    setSetup((s) => ({ ...s, [field]: value }));

  useEffect(() => {
    firstButton.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const run = (action: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      const res = await action();
      if (!res.ok) onError(res.error ?? "Não foi possível salvar.");
      onClose();
    });

  return (
    <div
      data-game-modal
      className="pointer-events-auto absolute inset-0 z-20 grid place-items-center bg-black/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="desk-dialog-title"
        className="max-h-full w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-700 bg-slate-950 p-5 shadow-2xl"
      >
        <h2 id="desk-dialog-title" className="text-lg font-semibold">
          Sua mesa
        </h2>
        <div className="mt-4 flex justify-center rounded-xl bg-[#c8a27a] p-4">
          <DeskPreview setup={setup} />
        </div>

        <fieldset className="mt-5">
          <legend className="text-sm font-medium text-slate-300">Modelo</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {DESK_MODELS.map((label, i) => (
              <button
                key={label}
                ref={i === 0 ? firstButton : undefined}
                type="button"
                aria-pressed={setup.model === i}
                onClick={() => set("model", i)}
                className={choiceClass(setup.model === i)}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-4">
          <legend className="text-sm font-medium text-slate-300">Telas</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {DESK_SCREENS.map((label, i) => (
              <button
                key={label}
                type="button"
                aria-pressed={setup.screens === i}
                onClick={() => set("screens", i)}
                className={choiceClass(setup.screens === i)}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-4">
          <legend className="text-sm font-medium text-slate-300">Cor das telas</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {SCREEN_COLORS.map((color, i) => (
              <button
                key={color}
                type="button"
                aria-pressed={setup.screenColor === i}
                onClick={() => set("screenColor", i)}
                className={choiceClass(setup.screenColor === i)}
              >
                <span
                  className="mr-1.5 inline-block size-3 rounded-sm border border-slate-500 align-[-1px]"
                  style={{ backgroundColor: color }}
                />
                {SCREEN_COLOR_NAMES[i]}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-4">
          <legend className="text-sm font-medium text-slate-300">Tampo</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {DESK_SURFACES.map((color, i) => (
              <button
                key={color}
                type="button"
                aria-pressed={setup.surface === i}
                onClick={() => set("surface", i)}
                className={choiceClass(setup.surface === i)}
              >
                <span
                  className="mr-1.5 inline-block size-3 rounded-sm align-[-1px]"
                  style={{ backgroundColor: color }}
                />
                {DESK_SURFACE_NAMES[i]}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-4">
          <legend className="text-sm font-medium text-slate-300">Cadeira</legend>
          {setup.model === STANDING_MODEL ? (
            <p className="mt-2 text-sm text-slate-400">Mesa em pé não tem cadeira.</p>
          ) : (
            <>
              <div className="mt-2 flex flex-wrap gap-2">
                {CHAIR_MODELS.map((label, i) => (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={setup.chairModel === i}
                    onClick={() => set("chairModel", i)}
                    className={choiceClass(setup.chairModel === i)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {CHAIR_COLORS.map((color, i) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`Cadeira: cor ${i + 1}`}
                    aria-pressed={setup.chair === i}
                    onClick={() => set("chair", i)}
                    style={{ backgroundColor: color }}
                    className={`size-8 rounded-lg border-2 ${
                      setup.chair === i
                        ? "border-emerald-400 ring-2 ring-emerald-400/40"
                        : "border-slate-700 hover:border-slate-400"
                    }`}
                  />
                ))}
              </div>
            </>
          )}
        </fieldset>

        <fieldset className="mt-4">
          <legend className="text-sm font-medium text-slate-300">Na mesa</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {TOGGLES.map(({ field, label }) => (
              <button
                key={field}
                type="button"
                aria-pressed={setup[field] === 1}
                onClick={() => set(field, setup[field] ? 0 : 1)}
                className={choiceClass(setup[field] === 1)}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => updateDeskSetup(spaceId, setup))}
            className="rounded-lg bg-emerald-500 px-4 py-2 font-medium text-black hover:bg-emerald-400 disabled:opacity-50"
          >
            {pending ? "Salvando…" : "Salvar"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 px-4 py-2 hover:border-slate-500"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (confirm("Liberar esta mesa? Outra pessoa poderá pegá-la.")) run(() => releaseDesk(spaceId));
            }}
            className="ml-auto rounded-lg px-3 py-2 text-sm text-red-400 hover:bg-red-500/10"
          >
            Liberar mesa
          </button>
        </div>
      </div>
    </div>
  );
}
