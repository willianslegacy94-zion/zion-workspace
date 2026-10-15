"use client";

import { useActionState, useState } from "react";
import { createSpace } from "@/app/dashboard/actions";
import { slugify } from "@/lib/space/slug";
import { inputClass, primaryButtonClass } from "./ui";

export default function CreateSpaceForm() {
  const [state, action, pending] = useActionState(createSpace, undefined);
  const [name, setName] = useState(state?.values?.name ?? "");
  const [slug, setSlug] = useState(state?.values?.slug ?? "");
  const preview = slugify(slug || name);

  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="text-sm text-slate-300" htmlFor="space-name">
        Nome
      </label>
      <input
        id="space-name"
        name="name"
        required
        minLength={2}
        maxLength={48}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Escritório São Paulo"
        className={inputClass}
      />

      <label className="text-sm text-slate-300" htmlFor="space-slug">
        Endereço <span className="text-slate-500">(opcional, gerado do nome)</span>
      </label>
      <input
        id="space-slug"
        name="slug"
        maxLength={48}
        value={slug}
        onChange={(e) => setSlug(e.target.value)}
        placeholder={slugify(name) || "escritorio-sao-paulo"}
        className={inputClass}
      />
      <p className="text-xs text-slate-500">/space/{preview || "…"}</p>

      {state?.error && (
        <p role="alert" className="text-sm text-red-400">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending ? "Criando…" : "Criar escritório"}
      </button>
    </form>
  );
}
