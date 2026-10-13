"use client";

import { useActionState } from "react";
import { addMember } from "@/app/dashboard/actions";
import { inputClass, primaryButtonClass, ROLE_LABEL } from "./ui";

export default function AddMemberForm({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState(addMember, undefined);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="slug" value={slug} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="member-email">
          E-mail
        </label>
        <input
          id="member-email"
          name="email"
          type="email"
          required
          placeholder="e-mail da pessoa"
          // Após sucesso o campo zera (key muda); após erro mantém o digitado.
          key={state?.ok ?? "form"}
          defaultValue={state?.ok ? "" : state?.values?.email}
          className={`${inputClass} min-w-0 flex-1`}
        />
        <label className="sr-only" htmlFor="member-role">
          Papel
        </label>
        <select
          id="member-role"
          name="role"
          defaultValue={state?.values?.role ?? "MEMBER"}
          className={inputClass}
        >
          {Object.entries(ROLE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button type="submit" disabled={pending} className={primaryButtonClass}>
          {pending ? "Adicionando…" : "Adicionar"}
        </button>
      </div>
      {state?.error && (
        <p role="alert" className="text-sm text-red-400">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p role="status" className="text-sm text-emerald-400">
          {state.ok}
        </p>
      )}
    </form>
  );
}
