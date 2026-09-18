"use client";

import { useEffect, useState, useTransition } from "react";
import { buscarResumoVendas, type ResumoVendas } from "@/server/actions/relatorios";
import { formatBRL } from "@/lib/currency";

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

export function RelatoriosClient() {
  const [preset, setPreset] = useState<PeriodoPreset>("hoje");
  const [de, setDe] = useState(dataISO(new Date()));
  const [ate, setAte] = useState(dataISO(new Date()));
  const [resumo, setResumo] = useState<ResumoVendas | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const intervalo = calcularIntervalo(preset, de, ate);
    startTransition(() => {
      buscarResumoVendas(intervalo).then(setResumo);
    });
  }, [preset, de, ate]);

  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-4 p-4 md:p-7">
      <h1 className="text-lg font-semibold text-vesale-ink">Relatórios de vendas</h1>

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

      {!resumo || isPending ? (
        <p className="text-sm text-vesale-muted">Carregando…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-vesale-border bg-vesale-surface p-4">
              <p className="text-xs uppercase tracking-wide text-vesale-muted">Total vendido</p>
              <p className="text-xl font-bold text-vesale-ink">{formatBRL(resumo.totalVendido)}</p>
            </div>
            <div className="rounded-2xl border border-vesale-border bg-vesale-surface p-4">
              <p className="text-xs uppercase tracking-wide text-vesale-muted">Vendas</p>
              <p className="text-xl font-bold text-vesale-ink">{resumo.quantidadeVendas}</p>
            </div>
            <div className="rounded-2xl border border-vesale-border bg-vesale-surface p-4">
              <p className="text-xs uppercase tracking-wide text-vesale-muted">Ticket médio</p>
              <p className="text-xl font-bold text-vesale-ink">{formatBRL(resumo.ticketMedio)}</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-vesale-border bg-vesale-surface p-4">
              <h2 className="mb-3 text-sm font-semibold text-vesale-ink">Produtos mais vendidos</h2>
              {resumo.produtosMaisVendidos.length === 0 ? (
                <p className="text-sm text-vesale-muted">Nenhuma venda no período.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {resumo.produtosMaisVendidos.map((produto) => (
                    <li key={produto.produtoId} className="flex items-center justify-between text-sm">
                      <span className="truncate text-vesale-ink">{produto.nome}</span>
                      <span className="text-vesale-muted">{produto.quantidade} un</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-2xl border border-vesale-border bg-vesale-surface p-4">
              <h2 className="mb-3 text-sm font-semibold text-vesale-ink">Por forma de pagamento</h2>
              {resumo.porFormaPagamento.length === 0 ? (
                <p className="text-sm text-vesale-muted">Nenhuma venda no período.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {resumo.porFormaPagamento.map((forma) => (
                    <li key={forma.formaPagamentoId} className="flex items-center justify-between text-sm">
                      <span className="text-vesale-ink">{forma.nome}</span>
                      <span className="text-vesale-muted">{formatBRL(forma.total)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
