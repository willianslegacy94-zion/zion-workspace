"use client";

import { useActionState, useEffect, useState } from "react";
import { fecharCaixa, resumoSessaoAtual, type FecharCaixaState } from "@/server/actions/pdv";
import { formatBRL } from "@/lib/currency";

const estadoInicial: FecharCaixaState = { ok: false };

export function FecharCaixaForm({
  sessaoCaixaId,
  valorAbertura,
  onCancelar,
  onFechado,
}: {
  sessaoCaixaId: string;
  valorAbertura: number;
  onCancelar: () => void;
  onFechado: () => void;
}) {
  const [state, formAction, isPending] = useActionState(fecharCaixa, estadoInicial);
  const [totalVendido, setTotalVendido] = useState<number | null>(null);

  useEffect(() => {
    resumoSessaoAtual(sessaoCaixaId).then((r) => setTotalVendido(r.totalVendido));
  }, [sessaoCaixaId]);

  useEffect(() => {
    if (state.ok) onFechado();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok]);

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-vesale-border bg-vesale-surface p-8 shadow-sm">
        <h2 className="mb-1 text-lg font-semibold text-vesale-ink">Fechar caixa</h2>
        <p className="mb-1 text-sm text-vesale-muted">
          {totalVendido === null ? "Calculando total vendido..." : `Total vendido na sessão: ${formatBRL(totalVendido)}`}
        </p>
        <p className="mb-6 text-sm text-vesale-muted">
          {totalVendido === null
            ? " "
            : `Esperado na gaveta (abertura + vendas): ${formatBRL(valorAbertura + totalVendido)}`}
        </p>

        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="sessaoCaixaId" value={sessaoCaixaId} />

          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-vesale-muted">
              Valor apurado no fechamento (R$)
            </label>
            <input
              name="valorFechamento"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              required
              autoFocus
              className="w-full rounded-lg border border-vesale-border px-3 py-2 text-vesale-ink outline-none focus:border-vesale-navy"
            />
          </div>

          {state.message && (
            <p className="rounded-lg border border-vesale-red/30 bg-vesale-red/5 px-3 py-2 text-center text-xs text-vesale-red">
              {state.message}
            </p>
          )}

          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={onCancelar}
              className="flex-1 rounded-lg border border-vesale-border py-2.5 font-medium text-vesale-ink transition hover:bg-vesale-bg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 rounded-lg bg-vesale-navy py-2.5 font-medium text-white transition hover:bg-vesale-navy-dark disabled:opacity-60"
            >
              {isPending ? "Fechando..." : "Fechar caixa"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
