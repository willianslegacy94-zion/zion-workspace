"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  criarContaFinanceira,
  darBaixaConta,
  type AcaoState,
  type CategoriaFinanceiraOption,
  type ContaFinanceiraResumo,
  type ResumoCaixa,
} from "@/server/actions/financeiro";
import { formatBRL } from "@/lib/currency";

const estadoInicial: AcaoState = { ok: false };

const STATUS_LABEL: Record<string, string> = {
  PENDENTE: "Pendente",
  PAGA_RECEBIDA: "Baixada",
  VENCIDA: "Vencida",
};

const STATUS_COR: Record<string, string> = {
  PENDENTE: "bg-vesale-muted/10 text-vesale-muted",
  PAGA_RECEBIDA: "bg-vesale-success/10 text-vesale-success",
  VENCIDA: "bg-vesale-red/10 text-vesale-red",
};

function NovaContaForm({
  tipo,
  categorias,
  onLancada,
}: {
  tipo: "PAGAR" | "RECEBER";
  categorias: CategoriaFinanceiraOption[];
  onLancada: () => void;
}) {
  const [state, formAction, isPending] = useActionState(criarContaFinanceira, estadoInicial);

  useEffect(() => {
    if (state.ok) onLancada();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok]);

  return (
    <form
      key={state.ok ? "lancada" : "pendente"}
      action={formAction}
      className="flex flex-col gap-3 rounded-2xl border border-vesale-border bg-vesale-surface p-4 sm:flex-row sm:flex-wrap sm:items-end"
    >
      <input type="hidden" name="tipo" value={tipo} />

      <div className="flex-1">
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-vesale-muted">
          Descrição
        </label>
        <input
          name="descricao"
          required
          className="w-full rounded-lg border border-vesale-border px-3 py-2 text-sm text-vesale-ink outline-none focus:border-vesale-navy"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-vesale-muted">
          Categoria
        </label>
        <select
          name="categoriaId"
          required
          defaultValue=""
          className="rounded-lg border border-vesale-border px-3 py-2 text-sm text-vesale-ink outline-none focus:border-vesale-navy"
        >
          <option value="" disabled>
            Selecione…
          </option>
          {categorias.map((categoria) => (
            <option key={categoria.id} value={categoria.id}>
              {categoria.nome}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-vesale-muted">
          Valor (R$)
        </label>
        <input
          name="valor"
          type="number"
          step="0.01"
          min="0"
          required
          className="w-28 rounded-lg border border-vesale-border px-3 py-2 text-sm text-vesale-ink outline-none focus:border-vesale-navy"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-vesale-muted">
          Vencimento
        </label>
        <input
          name="vencimento"
          type="date"
          required
          className="rounded-lg border border-vesale-border px-3 py-2 text-sm text-vesale-ink outline-none focus:border-vesale-navy"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-vesale-navy px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-vesale-navy-dark disabled:opacity-60"
      >
        {isPending ? "Lançando..." : "Lançar"}
      </button>

      {state.message && (
        <p className="w-full rounded-lg border border-vesale-red/30 bg-vesale-red/5 px-3 py-2 text-xs text-vesale-red">
          {state.message}
        </p>
      )}
    </form>
  );
}

function ListaContas({ contas, onBaixada }: { contas: ContaFinanceiraResumo[]; onBaixada: (id: string) => void }) {
  async function handleBaixa(id: string) {
    const resultado = await darBaixaConta(id);
    if (resultado.ok) onBaixada(id);
  }

  if (contas.length === 0) {
    return <p className="p-8 text-center text-sm text-vesale-muted">Nenhuma conta lançada ainda.</p>;
  }

  return (
    <ul className="divide-y divide-vesale-border">
      {contas.map((conta) => (
        <li key={conta.id} className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-vesale-ink">{conta.descricao}</p>
            <p className="text-xs text-vesale-muted">
              {conta.categoriaNome} · vence {new Date(`${conta.vencimento}T00:00:00`).toLocaleDateString("pt-BR")}
            </p>
          </div>

          <span className="text-sm font-semibold text-vesale-ink">{formatBRL(conta.valor)}</span>

          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_COR[conta.status]}`}>
            {STATUS_LABEL[conta.status]}
          </span>

          {conta.status !== "PAGA_RECEBIDA" && (
            <button
              type="button"
              onClick={() => handleBaixa(conta.id)}
              className="rounded-lg border border-vesale-border px-3 py-1.5 text-xs font-medium text-vesale-ink transition hover:bg-vesale-bg"
            >
              Dar baixa
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

function CaixaPanel({ resumo }: { resumo: ResumoCaixa }) {
  return (
    <div className="rounded-2xl border border-vesale-border bg-vesale-surface">
      <div className="border-b border-vesale-border px-4 py-2.5 text-sm font-semibold text-vesale-ink">Caixa</div>
      <div className="flex flex-col gap-3 p-4">
        {resumo.sessaoAberta ? (
          <div className="flex flex-col gap-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-vesale-muted">Aberto em</span>
              <span className="text-vesale-ink">{new Date(resumo.sessaoAberta.abertaEm).toLocaleString("pt-BR")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-vesale-muted">Valor de abertura</span>
              <span className="text-vesale-ink">{formatBRL(resumo.sessaoAberta.valorAbertura)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-vesale-muted">Vendas no período</span>
              <span className="text-vesale-ink">{formatBRL(resumo.sessaoAberta.totalVendido)}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span className="text-vesale-muted">Esperado no fechamento</span>
              <span className="text-vesale-ink">{formatBRL(resumo.sessaoAberta.esperado)}</span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-vesale-muted">Nenhum caixa aberto agora. Abra o caixa em PDV.</p>
        )}

        {resumo.historico.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-vesale-muted">
              Histórico recente
            </p>
            <div className="flex flex-col gap-1.5">
              {resumo.historico.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg bg-vesale-bg px-3 py-2 text-xs">
                  <span className="text-vesale-ink">{new Date(s.abertaEm).toLocaleDateString("pt-BR")}</span>
                  <span className="font-semibold text-vesale-ink">{formatBRL(s.totalVendido)}</span>
                  <span className={Math.abs(s.diferenca) < 0.01 ? "text-vesale-success" : "text-vesale-red"}>
                    dif. {formatBRL(s.diferenca)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function FinanceiroClient({
  contasIniciais,
  categorias,
  resumoCaixa,
}: {
  contasIniciais: ContaFinanceiraResumo[];
  categorias: CategoriaFinanceiraOption[];
  resumoCaixa: ResumoCaixa;
}) {
  const router = useRouter();
  const [aba, setAba] = useState<"PAGAR" | "RECEBER">("PAGAR");
  const [contas, setContas] = useState(contasIniciais);
  // Ajusta o estado local quando o servidor manda uma lista nova (após
  // router.refresh()) — setState durante o render, não em efeito, para não
  // gerar um commit extra (padrão "Adjusting state when a prop changes").
  const [contasSincronizadas, setContasSincronizadas] = useState(contasIniciais);
  if (contasIniciais !== contasSincronizadas) {
    setContasSincronizadas(contasIniciais);
    setContas(contasIniciais);
  }

  function marcarBaixada(id: string) {
    setContas((atual) =>
      atual.map((c) => (c.id === id ? { ...c, status: "PAGA_RECEBIDA" as const } : c)),
    );
  }

  const contasDaAba = contas.filter((c) => c.tipo === aba);

  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-4 p-4 md:p-7">
      <h1 className="text-lg font-semibold text-vesale-ink">Financeiro</h1>

      <CaixaPanel resumo={resumoCaixa} />

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setAba("PAGAR")}
          className={`rounded-lg border px-4 py-2 text-sm transition ${
            aba === "PAGAR"
              ? "border-vesale-navy bg-vesale-navy text-white"
              : "border-vesale-border text-vesale-ink hover:bg-vesale-bg"
          }`}
        >
          A pagar
        </button>
        <button
          type="button"
          onClick={() => setAba("RECEBER")}
          className={`rounded-lg border px-4 py-2 text-sm transition ${
            aba === "RECEBER"
              ? "border-vesale-navy bg-vesale-navy text-white"
              : "border-vesale-border text-vesale-ink hover:bg-vesale-bg"
          }`}
        >
          A receber
        </button>
      </div>

      <NovaContaForm tipo={aba} categorias={categorias} onLancada={() => router.refresh()} />

      <div className="rounded-2xl border border-vesale-border bg-vesale-surface">
        <ListaContas contas={contasDaAba} onBaixada={marcarBaixada} />
      </div>
    </div>
  );
}
