"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { DIA_SEMANA_LABEL, type CelulaMatricula } from "@/lib/agenda-constants";

const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const FORMAS_PAGAMENTO = ["PIX", "Dinheiro", "Cartão"];

export function MatricularAcaoCelula({
  celula,
  modalidade,
  dia,
  preco,
  matricularAction,
  cancelarAction,
}: {
  celula: CelulaMatricula;
  modalidade: string;
  dia: string;
  preco: number;
  matricularAction: (agendaAulaId: string, formaPagamento: string) => Promise<void>;
  cancelarAction: (agendaAulaId: string) => Promise<void>;
}) {
  const [modalAberto, setModalAberto] = useState(false);
  const [formaPagamento, setFormaPagamento] = useState(FORMAS_PAGAMENTO[0]);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const lotado = !celula.matriculado && celula.vagas <= 0;

  function confirmar() {
    setErro(null);
    startTransition(async () => {
      try {
        await matricularAction(celula.id, formaPagamento);
        setModalAberto(false);
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Não foi possível matricular.");
      }
    });
  }

  if (celula.matriculado) {
    return (
      <form action={cancelarAction.bind(null, celula.id)}>
        <button
          type="submit"
          className="whitespace-nowrap rounded-md border border-error/30 px-2 py-0.5 text-[10px] font-medium text-error transition-colors hover:bg-error/10"
        >
          Cancelar
        </button>
      </form>
    );
  }

  if (lotado) {
    return (
      <span className="whitespace-nowrap rounded-md bg-error/10 px-2 py-0.5 text-[10px] font-medium text-error/70">
        Lotado
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setModalAberto(true)}
        className="whitespace-nowrap rounded-md bg-primary px-2 py-0.5 text-[10px] font-medium text-background transition-colors hover:bg-secondary"
      >
        Matricular-se
      </button>

      {modalAberto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in"
          onClick={() => !pending && setModalAberto(false)}
        >
          <div
            className="card-premium w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-serif text-lg font-bold text-primary">
                Confirmar matrícula
              </h3>
              <button
                type="button"
                onClick={() => setModalAberto(false)}
                disabled={pending}
                aria-label="Fechar"
                className="rounded-lg p-1 text-foreground/50 transition-colors hover:bg-surface-hover hover:text-primary disabled:opacity-40"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mb-4 flex flex-col gap-2 rounded-lg border border-surface-border p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-foreground/50">Modalidade</span>
                <span className="font-medium text-foreground">{modalidade}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-foreground/50">Horário</span>
                <span className="font-medium text-foreground">
                  {DIA_SEMANA_LABEL[dia]} {celula.hora}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-surface-border pt-2">
                <span className="text-foreground/50">Valor</span>
                <span className="font-serif text-lg font-bold text-primary">
                  {moeda.format(preco)}
                </span>
              </div>
            </div>

            <label className="mb-4 flex flex-col gap-1 text-sm">
              Forma de pagamento
              <select
                value={formaPagamento}
                onChange={(e) => setFormaPagamento(e.target.value)}
                className="rounded-md border border-foreground/20 bg-background px-3 py-2 outline-none focus:border-primary"
              >
                {FORMAS_PAGAMENTO.map((forma) => (
                  <option key={forma} value={forma}>
                    {forma}
                  </option>
                ))}
              </select>
            </label>

            <p className="mb-4 text-xs text-foreground/50">
              Ao confirmar, sua matrícula é reservada e uma cobrança é gerada.
              Envie o comprovante depois na aba Financeiro.
            </p>

            {erro && (
              <p className="mb-3 rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-xs text-error animate-fade-in">
                {erro}
              </p>
            )}

            <button
              type="button"
              onClick={confirmar}
              disabled={pending}
              className="btn-gold w-full disabled:opacity-60"
            >
              {pending ? "Confirmando..." : "Confirmar pagamento"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
