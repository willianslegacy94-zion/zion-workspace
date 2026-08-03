"use client";

import { useId, useState } from "react";
import { MODALIDADES } from "@/lib/modalidades";
import { DIA_SEMANA_LABEL, type HorarioResumo } from "@/lib/agenda-constants";

type Linha = { chave: string; modalidade: string };
type PacoteComboOpcao = { id: string; nome: string; descontoPadrao: number | null };

const MAX_MODALIDADES = MODALIDADES.length;

// Cadastro com uma ou mais modalidades: a primeira é a principal (dá acesso
// implícito a todos os horários dela — o horário aqui é só referência), as
// seguintes são extras (exigem escolher um horário real, que vira Matricula
// + cobrança) e cada uma tem sua própria faixa/graduação.
export function SeletorModalidadesMultiplas({
  horarios,
  pacotesCombo = [],
}: {
  horarios: HorarioResumo[];
  pacotesCombo?: PacoteComboOpcao[];
}) {
  const idBase = useId();
  const [linhas, setLinhas] = useState<Linha[]>([
    { chave: `${idBase}-0`, modalidade: "" },
  ]);

  function adicionarLinha() {
    setLinhas((atual) => [
      ...atual,
      { chave: `${idBase}-${atual.length}-${Date.now()}`, modalidade: "" },
    ]);
  }

  function removerLinha(chave: string) {
    setLinhas((atual) => atual.filter((l) => l.chave !== chave));
  }

  function atualizarModalidade(chave: string, modalidade: string) {
    setLinhas((atual) =>
      atual.map((l) => (l.chave === chave ? { ...l, modalidade } : l)),
    );
  }

  const modalidadesEmUso = new Set(
    linhas.map((l) => l.modalidade).filter(Boolean),
  );

  return (
    <div className="flex flex-col gap-4">
      {linhas.map((linha, index) => {
        const principal = index === 0;
        const horariosDaModalidade = horarios.filter(
          (h) => h.modalidade === linha.modalidade,
        );

        return (
          <div
            key={linha.chave}
            className="flex flex-col gap-3 rounded-lg border border-foreground/10 p-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-foreground/50">
                {principal ? "Modalidade principal" : `Modalidade extra ${index}`}
              </span>
              {!principal && (
                <button
                  type="button"
                  onClick={() => removerLinha(linha.chave)}
                  className="text-xs text-error hover:underline"
                >
                  Remover
                </button>
              )}
            </div>

            <label className="flex flex-col gap-1 text-sm">
              Modalidade
              <select
                name="modalidade"
                required
                value={linha.modalidade}
                onChange={(e) => atualizarModalidade(linha.chave, e.target.value)}
                className="rounded-md border border-foreground/20 bg-background px-3 py-2 outline-none focus:border-primary"
              >
                <option value="" disabled>
                  Selecione
                </option>
                {MODALIDADES.map((m) => (
                  <option
                    key={m}
                    value={m}
                    disabled={m !== linha.modalidade && modalidadesEmUso.has(m)}
                  >
                    {m}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm">
              Horário
              <select
                name="agendaAulaId"
                required
                defaultValue=""
                disabled={!linha.modalidade}
                className="rounded-md border border-foreground/20 bg-background px-3 py-2 outline-none focus:border-primary disabled:opacity-40"
              >
                <option value="" disabled>
                  Selecione um horário
                </option>
                {horariosDaModalidade.map((h) => (
                  <option key={h.id} value={h.id}>
                    {DIA_SEMANA_LABEL[h.diaSemana]} {h.hora}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm">
              Faixa / Graduação {principal ? "(opcional)" : ""}
              <input
                name="graduacaoFaixa"
                placeholder="Ex: Faixa Azul"
                className="rounded-md border border-foreground/20 bg-background px-3 py-2 outline-none focus:border-primary"
              />
            </label>
          </div>
        );
      })}

      {linhas.length < MAX_MODALIDADES && (
        <button
          type="button"
          onClick={adicionarLinha}
          className="text-left text-xs text-primary hover:underline"
        >
          + Adicionar outra modalidade
        </button>
      )}

      {linhas.length > 1 && pacotesCombo.length > 0 && (
        <label className="flex flex-col gap-1 text-sm">
          Pacote combo (opcional)
          <select
            name="pacoteComboId"
            defaultValue=""
            className="rounded-md border border-foreground/20 bg-background px-3 py-2 outline-none focus:border-primary"
          >
            <option value="">Nenhum</option>
            {pacotesCombo.map((pacote) => (
              <option key={pacote.id} value={pacote.id}>
                {pacote.nome}
                {pacote.descontoPadrao ? ` (${pacote.descontoPadrao}% off)` : ""}
              </option>
            ))}
          </select>
          <span className="text-xs text-foreground/40">
            Desconto sobre a mensalidade + modalidades extras combinadas.
          </span>
        </label>
      )}
    </div>
  );
}
