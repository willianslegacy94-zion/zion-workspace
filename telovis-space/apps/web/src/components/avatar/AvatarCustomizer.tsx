"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  AVATAR_FIELDS,
  avatarOptionCount,
  HAIR_COLORS,
  HAIR_STYLES,
  PANTS_COLORS,
  SHIRT_COLORS,
  SKIN_TONES,
  type AvatarLook,
  type Direction,
} from "@telovis/protocol";
import { saveAvatar } from "@/app/avatar-actions";
import { DIR_ORDER } from "@/game/avatar-draw";
import AvatarPreview from "./AvatarPreview";

const DIR_LABEL: Record<Direction, string> = {
  down: "de frente",
  left: "para a esquerda",
  right: "para a direita",
  up: "de costas",
};

const SWATCHES: { field: keyof AvatarLook; title: string; colors: readonly string[] }[] = [
  { field: "skin", title: "Pele", colors: SKIN_TONES },
  { field: "hair", title: "Cor do cabelo", colors: HAIR_COLORS },
  { field: "shirt", title: "Camisa", colors: SHIRT_COLORS },
  { field: "pants", title: "Calça", colors: PANTS_COLORS },
];

function randomLook(): AvatarLook {
  const look = {} as AvatarLook;
  for (const f of AVATAR_FIELDS) look[f] = Math.floor(Math.random() * avatarOptionCount(f));
  return look;
}

const outlineButton = "rounded-lg border border-slate-700 hover:border-slate-500";

export default function AvatarCustomizer({
  initial,
  name,
  backHref,
}: {
  initial: AvatarLook;
  name: string;
  backHref: string;
}) {
  const [look, setLook] = useState(initial);
  const [dirIndex, setDirIndex] = useState(0);
  const [state, action, pending] = useActionState(saveAvatar, undefined);
  const direction = DIR_ORDER[dirIndex];
  const set = (field: keyof AvatarLook, value: number) =>
    setLook((l) => ({ ...l, [field]: value }));
  const rotate = (by: number) =>
    setDirIndex((i) => (i + by + DIR_ORDER.length) % DIR_ORDER.length);

  return (
    <div className="grid gap-8 md:grid-cols-[auto_1fr]">
      <section aria-label="Prévia" className="flex flex-col items-center gap-3">
        <div className="rounded-2xl border border-slate-800 bg-[#1f2433] p-4">
          <AvatarPreview
            look={look}
            direction={direction}
            scale={8}
            walking
            label={`Prévia de ${name} andando ${DIR_LABEL[direction]}`}
          />
        </div>
        <p className="font-mono text-sm">{name}</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => rotate(-1)}
            aria-label="Girar para a esquerda"
            className={`${outlineButton} px-3 py-1`}
          >
            ⟲
          </button>
          <button
            type="button"
            onClick={() => rotate(1)}
            aria-label="Girar para a direita"
            className={`${outlineButton} px-3 py-1`}
          >
            ⟳
          </button>
        </div>
        <div className="flex gap-1">
          {DIR_ORDER.map((d, i) => (
            <button
              key={d}
              type="button"
              aria-label={`Ver ${DIR_LABEL[d]}`}
              aria-pressed={i === dirIndex}
              onClick={() => setDirIndex(i)}
              className={`rounded-md p-1 ${i === dirIndex ? "bg-slate-700" : "hover:bg-slate-800"}`}
            >
              <AvatarPreview look={look} direction={d} scale={2} />
            </button>
          ))}
        </div>
      </section>

      <form action={action} className="flex flex-col gap-6">
        {AVATAR_FIELDS.map((f) => (
          <input key={f} type="hidden" name={f} value={look[f]} />
        ))}
        <input type="hidden" name="next" value={backHref} />

        <fieldset>
          <legend className="text-sm font-medium text-slate-300">Cabelo</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {HAIR_STYLES.map((style, i) => (
              <button
                key={style}
                type="button"
                aria-pressed={look.hairStyle === i}
                onClick={() => set("hairStyle", i)}
                className={`rounded-lg border px-3 py-1.5 text-sm capitalize ${
                  look.hairStyle === i
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-300"
                    : "border-slate-700 hover:border-slate-500"
                }`}
              >
                {style}
              </button>
            ))}
          </div>
        </fieldset>

        {SWATCHES.map(({ field, title, colors }) => (
          <fieldset key={field}>
            <legend className="text-sm font-medium text-slate-300">{title}</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {colors.map((color, i) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`${title}: opção ${i + 1}`}
                  aria-pressed={look[field] === i}
                  onClick={() => set(field, i)}
                  style={{ backgroundColor: color }}
                  className={`size-9 rounded-lg border-2 ${
                    look[field] === i
                      ? "border-emerald-400 ring-2 ring-emerald-400/40"
                      : "border-slate-700 hover:border-slate-400"
                  }`}
                />
              ))}
            </div>
          </fieldset>
        ))}

        {state?.error && (
          <p role="alert" className="text-sm text-red-400">
            {state.error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-emerald-500 px-4 py-2 font-medium text-black hover:bg-emerald-400 disabled:opacity-50"
          >
            {pending ? "Salvando…" : "Salvar e voltar"}
          </button>
          <button type="button" onClick={() => setLook(randomLook())} className={`${outlineButton} px-4 py-2`}>
            Aleatório
          </button>
          <button
            type="button"
            onClick={() => setLook(initial)}
            className="rounded-lg px-3 py-2 text-sm text-slate-400 hover:text-slate-200"
          >
            Desfazer
          </button>
          <Link href={backHref} className="text-sm text-slate-400 hover:text-slate-200">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
