"use client";

import { useState } from "react";
import { MODALIDADES } from "@/lib/modalidades";
import { DIA_SEMANA_LABEL, type HorarioResumo } from "@/lib/agenda-constants";

export function SeletorModalidadeHorario({
  horarios,
  defaultModalidade = "",
  defaultAgendaAulaId = "",
}: {
  horarios: HorarioResumo[];
  defaultModalidade?: string;
  defaultAgendaAulaId?: string;
}) {
  const [modalidade, setModalidade] = useState(defaultModalidade);

  const horariosDaModalidade = horarios.filter(
    (h) => h.modalidade === modalidade,
  );

  return (
    <>
      <label className="flex flex-col gap-1 text-sm">
        Modalidade
        <select
          name="modalidade"
          required
          value={modalidade}
          onChange={(e) => setModalidade(e.target.value)}
          className="rounded-md border border-foreground/20 bg-background px-3 py-2 outline-none focus:border-primary"
        >
          <option value="" disabled>
            Selecione
          </option>
          {MODALIDADES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Horário
        <select
          name="agendaAulaReferenciaId"
          required
          defaultValue={defaultAgendaAulaId}
          disabled={!modalidade}
          className="rounded-md border border-foreground/20 bg-background px-3 py-2 outline-none focus:border-primary disabled:opacity-40"
        >
          <option value="" disabled>
            {modalidade ? "Selecione um horário" : "Escolha a modalidade primeiro"}
          </option>
          {horariosDaModalidade.map((h) => (
            <option key={h.id} value={h.id}>
              {DIA_SEMANA_LABEL[h.diaSemana]} {h.hora}
            </option>
          ))}
        </select>
        {modalidade && horariosDaModalidade.length === 0 && (
          <span className="text-xs text-error">
            Nenhum horário cadastrado pra essa modalidade ainda — crie um em
            Configurações → Agenda antes de continuar.
          </span>
        )}
      </label>
    </>
  );
}
