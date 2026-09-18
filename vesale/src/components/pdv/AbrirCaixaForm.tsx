"use client";

import { useActionState } from "react";
import { abrirCaixa, type AbrirCaixaState } from "@/server/actions/pdv";

const estadoInicial: AbrirCaixaState = { ok: false };

export function AbrirCaixaForm() {
  const [state, formAction, isPending] = useActionState(abrirCaixa, estadoInicial);

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-vesale-border bg-vesale-surface p-8 shadow-sm">
        <h1 className="mb-1 text-lg font-semibold text-vesale-ink">Abrir caixa</h1>
        <p className="mb-6 text-sm text-vesale-muted">
          Informe o valor inicial em caixa para começar a vender.
        </p>

        <form action={formAction} className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-vesale-muted">
              Valor de abertura (R$)
            </label>
            <input
              name="valorAbertura"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              required
              autoFocus
              defaultValue="0"
              className="w-full rounded-lg border border-vesale-border px-3 py-2 text-vesale-ink outline-none focus:border-vesale-navy"
            />
          </div>

          {state.message && (
            <p className="rounded-lg border border-vesale-red/30 bg-vesale-red/5 px-3 py-2 text-center text-xs text-vesale-red">
              {state.message}
            </p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="mt-2 w-full rounded-lg bg-vesale-navy py-2.5 font-medium text-white transition hover:bg-vesale-navy-dark disabled:opacity-60"
          >
            {isPending ? "Abrindo..." : "Abrir caixa"}
          </button>
        </form>
      </div>
    </div>
  );
}
