"use client";

import { useActionState } from "react";
import { uploadNotaFiscal, type UploadNotaState } from "@/server/actions/notas-fiscais";

const estadoInicial: UploadNotaState = { ok: false };

export function UploadNotaForm() {
  const [state, formAction, isPending] = useActionState(uploadNotaFiscal, estadoInicial);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-2xl border border-vesale-border bg-vesale-surface p-4 sm:flex-row sm:items-end"
    >
      <div className="flex-1">
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-vesale-muted">
          Enviar nota fiscal (XML ou PDF)
        </label>
        <input
          key={state.ok ? "enviado" : "pendente"}
          name="arquivo"
          type="file"
          accept=".xml,.pdf,application/xml,text/xml,application/pdf"
          required
          className="w-full rounded-lg border border-vesale-border px-3 py-2 text-sm text-vesale-ink outline-none file:mr-3 file:rounded-md file:border-0 file:bg-vesale-navy file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-vesale-navy px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-vesale-navy-dark disabled:opacity-60"
      >
        {isPending ? "Processando..." : "Enviar"}
      </button>

      {state.message && (
        <p className="w-full rounded-lg border border-vesale-red/30 bg-vesale-red/5 px-3 py-2 text-xs text-vesale-red sm:w-auto">
          {state.message}
        </p>
      )}

      {state.ok && (
        <p className="w-full rounded-lg border border-vesale-success/30 bg-vesale-success/5 px-3 py-2 text-xs text-vesale-success sm:w-auto">
          Nota enviada — aguardando conciliação do gestor.
        </p>
      )}
    </form>
  );
}
