"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import {
  atualizarPrecoVenda,
  calcularCmvPeriodo,
  type PrecoFormState,
  type ProdutoPrecificacao,
  type ResumoCmv,
} from "@/server/actions/rentabilidade";
import { formatBRL } from "@/lib/currency";

const estadoInicial: PrecoFormState = { ok: false };

function dataISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

type PeriodoPreset = "hoje" | "7dias" | "30dias" | "personalizado";

function calcularIntervalo(preset: PeriodoPreset, de: string, ate: string): { de: string; ate: string } {
  const hoje = new Date();
  if (preset === "hoje") return { de: dataISO(hoje), ate: dataISO(hoje) };
  if (preset === "7dias") {
    const inicio = new Date(hoje);
    inicio.setDate(inicio.getDate() - 6);
    return { de: dataISO(inicio), ate: dataISO(hoje) };
  }
  if (preset === "30dias") {
    const inicio = new Date(hoje);
    inicio.setDate(inicio.getDate() - 29);
    return { de: dataISO(inicio), ate: dataISO(hoje) };
  }
  return { de, ate };
}

function EditarPrecoForm({ produto, onFechar }: { produto: ProdutoPrecificacao; onFechar: () => void }) {
  const action = atualizarPrecoVenda.bind(null, produto.id);
  const [state, formAction, isPending] = useActionState(action, estadoInicial);

  useEffect(() => {
    if (state.ok) onFechar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok]);

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-vesale-border bg-vesale-surface p-6 shadow-sm">
        <h2 className="mb-1 text-lg font-semibold text-vesale-ink">Editar preço de venda</h2>
        <p className="mb-4 text-sm text-vesale-muted">{produto.nome}</p>

        <p className="mb-4 text-sm text-vesale-muted">
          Custo travado:{" "}
          <span className="font-medium text-vesale-ink">
            {produto.custoTravado !== null ? formatBRL(produto.custoTravado) : "Custo pendente"}
          </span>
        </p>

        <form action={formAction} className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-vesale-muted">
              Novo preço de venda (R$)
            </label>
            <input
              name="precoVenda"
              type="number"
              step="0.01"
              min="0.01"
              required
              autoFocus
              defaultValue={produto.precoVenda ?? undefined}
              className="w-full rounded-lg border border-vesale-border px-3 py-2 text-sm text-vesale-ink outline-none focus:border-vesale-navy"
            />
          </div>

          {state.message && (
            <p className="rounded-lg border border-vesale-red/30 bg-vesale-red/5 px-3 py-2 text-xs text-vesale-red">
              {state.message}
            </p>
          )}

          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onFechar}
              className="rounded-lg border border-vesale-border px-3 py-2 text-sm text-vesale-ink hover:bg-vesale-bg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-vesale-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-vesale-navy-dark disabled:opacity-60"
            >
              {isPending ? "Salvando..." : "Salvar preço"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function RentabilidadeClient({ produtosIniciais }: { produtosIniciais: ProdutoPrecificacao[] }) {
  const produtos = produtosIniciais;
  const [editando, setEditando] = useState<ProdutoPrecificacao | null>(null);

  const [preset, setPreset] = useState<PeriodoPreset>("30dias");
  const [de, setDe] = useState(dataISO(new Date()));
  const [ate, setAte] = useState(dataISO(new Date()));
  const [resumoCmv, setResumoCmv] = useState<ResumoCmv | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const intervalo = calcularIntervalo(preset, de, ate);
    startTransition(() => {
      calcularCmvPeriodo(intervalo).then(setResumoCmv);
    });
  }, [preset, de, ate]);

  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-4 p-4 md:p-7">
      <h1 className="text-lg font-semibold text-vesale-ink">Lucro & Rentabilidade</h1>

      <div className="rounded-2xl border border-vesale-border bg-vesale-surface p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-vesale-ink">CMV do período</h2>
          <div className="flex flex-wrap items-center gap-2">
            {(["hoje", "7dias", "30dias", "personalizado"] as const).map((opcao) => (
              <button
                key={opcao}
                type="button"
                onClick={() => setPreset(opcao)}
                className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                  preset === opcao
                    ? "border-vesale-navy bg-vesale-navy text-white"
                    : "border-vesale-border text-vesale-ink hover:bg-vesale-bg"
                }`}
              >
                {opcao === "hoje" && "Hoje"}
                {opcao === "7dias" && "7 dias"}
                {opcao === "30dias" && "30 dias"}
                {opcao === "personalizado" && "Personalizado"}
              </button>
            ))}

            {preset === "personalizado" && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={de}
                  onChange={(e) => setDe(e.target.value)}
                  className="rounded-lg border border-vesale-border px-2 py-1.5 text-sm text-vesale-ink outline-none focus:border-vesale-navy"
                />
                <span className="text-sm text-vesale-muted">até</span>
                <input
                  type="date"
                  value={ate}
                  onChange={(e) => setAte(e.target.value)}
                  className="rounded-lg border border-vesale-border px-2 py-1.5 text-sm text-vesale-ink outline-none focus:border-vesale-navy"
                />
              </div>
            )}
          </div>
        </div>

        {!resumoCmv || isPending ? (
          <p className="text-sm text-vesale-muted">Carregando…</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl bg-vesale-bg p-3">
                <p className="text-xs uppercase tracking-wide text-vesale-muted">Receita</p>
                <p className="text-lg font-bold text-vesale-ink">{formatBRL(resumoCmv.receitaTotal)}</p>
              </div>
              <div className="rounded-xl bg-vesale-bg p-3">
                <p className="text-xs uppercase tracking-wide text-vesale-muted">CMV</p>
                <p className="text-lg font-bold text-vesale-ink">{formatBRL(resumoCmv.cmvTotal)}</p>
              </div>
              <div className="rounded-xl bg-vesale-bg p-3">
                <p className="text-xs uppercase tracking-wide text-vesale-muted">Lucro bruto</p>
                <p className={`text-lg font-bold ${resumoCmv.lucroBruto >= 0 ? "text-vesale-success" : "text-vesale-red"}`}>
                  {formatBRL(resumoCmv.lucroBruto)}
                </p>
              </div>
              <div className="rounded-xl bg-vesale-bg p-3">
                <p className="text-xs uppercase tracking-wide text-vesale-muted">Margem bruta</p>
                <p className="text-lg font-bold text-vesale-ink">{resumoCmv.margemBrutaPercentual.toFixed(1)}%</p>
              </div>
            </div>

            {resumoCmv.itensSemCustoTravado > 0 && (
              <p className="mt-3 text-xs text-vesale-warning">
                {resumoCmv.itensSemCustoTravado} unidade(s) vendida(s) no período sem custo travado no momento da
                venda — não entram no CMV (RN-012).
              </p>
            )}
          </>
        )}
      </div>

      <div className="rounded-2xl border border-vesale-border bg-vesale-surface">
        <div className="border-b border-vesale-border px-4 py-3">
          <h2 className="text-sm font-semibold text-vesale-ink">Precificação por produto</h2>
        </div>

        {produtos.length === 0 ? (
          <p className="p-8 text-center text-sm text-vesale-muted">Nenhum produto ativo cadastrado.</p>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-vesale-border text-left text-xs uppercase tracking-wide text-vesale-muted">
                  <th className="px-4 py-2.5 font-medium">Produto</th>
                  <th className="px-4 py-2.5 font-medium">Categoria</th>
                  <th className="px-4 py-2.5 font-medium">Custo travado</th>
                  <th className="px-4 py-2.5 font-medium">Preço de venda</th>
                  <th className="px-4 py-2.5 font-medium">Margem</th>
                  <th className="px-4 py-2.5 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {produtos.map((produto) => (
                  <tr
                    key={produto.id}
                    className={`border-b border-vesale-border last:border-0 ${
                      produto.margemNegativa ? "bg-vesale-red/5" : ""
                    }`}
                  >
                    <td className="px-4 py-2.5 font-medium text-vesale-ink">{produto.nome}</td>
                    <td className="px-4 py-2.5 text-vesale-muted">{produto.categoriaNome}</td>
                    <td className="px-4 py-2.5 text-vesale-ink">
                      {produto.custoTravado !== null ? (
                        formatBRL(produto.custoTravado)
                      ) : (
                        <span className="rounded-full bg-vesale-muted/10 px-2 py-1 text-xs text-vesale-muted">
                          Custo pendente
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-vesale-ink">
                      {produto.precoVenda !== null ? formatBRL(produto.precoVenda) : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      {produto.margemPercentual === null ? (
                        <span className="text-vesale-muted">—</span>
                      ) : (
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            produto.margemNegativa
                              ? "bg-vesale-red/10 text-vesale-red"
                              : "bg-vesale-success/10 text-vesale-success"
                          }`}
                        >
                          {produto.margemPercentual.toFixed(1)}%
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => setEditando(produto)}
                        className="rounded-lg border border-vesale-border px-3 py-1.5 text-xs font-medium text-vesale-ink hover:bg-vesale-bg"
                      >
                        Editar preço
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editando && <EditarPrecoForm produto={editando} onFechar={() => setEditando(null)} />}
    </div>
  );
}
