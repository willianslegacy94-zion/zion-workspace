import { CalendarClock, Tag, Clock, CalendarX, ListPlus, Trash2 } from "lucide-react";
import { getAgendaGrade } from "@/lib/agenda";
import { getPrecosModalidade } from "@/lib/precos";
import { getConfiguracaoAgenda } from "@/lib/configuracao-agenda";
import { getBloqueiosFuturos } from "@/lib/bloqueios-agenda";
import { DIAS_GRADE, DIA_SEMANA_LABEL, formatarHora } from "@/lib/agenda-constants";
import { MODALIDADES } from "@/lib/modalidades";
import { prisma } from "@/lib/prisma";
import { AgendaGrid } from "@/components/AgendaGrid";
import { PageHeader } from "@/components/PageHeader";
import {
  atualizarCapacidadeAula,
  criarAula,
  criarBloqueio,
  excluirAula,
  excluirBloqueio,
  salvarConfiguracaoAgenda,
  salvarPrecosModalidade,
} from "./actions";

export default async function AgendaPage() {
  const [linhas, precos, configAgenda, bloqueios, aulas] = await Promise.all([
    getAgendaGrade(),
    getPrecosModalidade(),
    getConfiguracaoAgenda(),
    getBloqueiosFuturos(),
    prisma.agendaAula.findMany({
      orderBy: [{ modalidade: "asc" }, { diaSemana: "asc" }, { horarioInicio: "asc" }],
    }),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-12">
      <PageHeader
        icon={CalendarClock}
        title="Agenda"
        subtitle="Grade de horários por modalidade"
      />

      <div className="flex flex-col gap-4 rounded-lg border border-foreground/10 p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <Tag size={18} className="text-primary" />
          Preços por modalidade
        </h2>
        <p className="text-sm text-foreground/50">
          Cobrado do aluno quando ele se matricula numa modalidade extra
          (além da principal) pela aba Matrícula do portal dele.
        </p>
        <form
          action={salvarPrecosModalidade}
          className="flex flex-col gap-4"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {Object.entries(precos).map(([modalidade, valor]) => (
              <label key={modalidade} className="flex flex-col gap-1 text-sm">
                {modalidade}
                <div className="flex items-center gap-1">
                  <span className="text-foreground/40">R$</span>
                  <input
                    name={`preco_${modalidade}`}
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={valor}
                    className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-primary"
                  />
                </div>
              </label>
            ))}
          </div>
          <button
            type="submit"
            className="self-start rounded-md bg-primary px-5 py-2 text-sm font-medium text-background transition-colors hover:bg-secondary"
          >
            Salvar preços
          </button>
        </form>
      </div>

      <div className="flex flex-col gap-4 rounded-lg border border-foreground/10 p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <Clock size={18} className="text-primary" />
          Horário de almoço
        </h2>
        <p className="text-sm text-foreground/50">
          Intervalo bloqueado pra criação de novos horários — vale pra todas as
          modalidades e dias.
        </p>
        <form action={salvarConfiguracaoAgenda} className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-sm">
            Início
            <input
              name="almocoInicio"
              type="time"
              defaultValue={configAgenda.almocoInicio ?? ""}
              className="rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-primary"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Fim
            <input
              name="almocoFim"
              type="time"
              defaultValue={configAgenda.almocoFim ?? ""}
              className="rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-primary"
            />
          </label>
          <button
            type="submit"
            className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-background transition-colors hover:bg-secondary"
          >
            Salvar
          </button>
        </form>
      </div>

      <div className="flex flex-col gap-4 rounded-lg border border-foreground/10 p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <CalendarX size={18} className="text-primary" />
          Bloqueios pontuais (compromissos)
        </h2>
        <p className="text-sm text-foreground/50">
          Avisa os alunos de que não vai ter aula num dia específico — não
          cancela matrículas automaticamente, é um aviso pro aluno não
          aparecer à toa.
        </p>
        <form action={criarBloqueio} className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-sm">
            Data
            <input
              name="data"
              type="date"
              required
              className="rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-primary"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Das
            <input
              name="horaInicio"
              type="time"
              required
              className="rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-primary"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Até
            <input
              name="horaFim"
              type="time"
              required
              className="rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-primary"
            />
          </label>
          <label className="flex flex-1 min-w-[180px] flex-col gap-1 text-sm">
            Motivo (opcional)
            <input
              name="motivo"
              placeholder="Ex: consulta médica"
              className="rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-primary"
            />
          </label>
          <button
            type="submit"
            className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-background transition-colors hover:bg-secondary"
          >
            Bloquear
          </button>
        </form>

        {bloqueios.length > 0 && (
          <div className="flex flex-col gap-2">
            {bloqueios.map((bloqueio) => (
              <div
                key={bloqueio.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-2.5 text-sm"
              >
                <span className="text-foreground">
                  <strong>{bloqueio.dataFormatada}</strong> · {bloqueio.horaInicio}–
                  {bloqueio.horaFim}
                  {bloqueio.motivo && ` — ${bloqueio.motivo}`}
                </span>
                <form action={excluirBloqueio.bind(null, bloqueio.id)}>
                  <button
                    type="submit"
                    aria-label="Excluir bloqueio"
                    className="text-foreground/40 transition-colors hover:text-error"
                  >
                    <Trash2 size={16} />
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 rounded-lg border border-foreground/10 p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <ListPlus size={18} className="text-primary" />
          Gerenciar horários e aulas
        </h2>
        <form action={criarAula} className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-sm">
            Modalidade
            <select
              name="modalidade"
              required
              className="rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-primary"
            >
              {MODALIDADES.map((modalidade) => (
                <option key={modalidade} value={modalidade}>
                  {modalidade}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Dia
            <select
              name="diaSemana"
              required
              className="rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-primary"
            >
              {DIAS_GRADE.map((dia) => (
                <option key={dia} value={dia}>
                  {DIA_SEMANA_LABEL[dia]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Horário
            <input
              name="hora"
              type="time"
              required
              className="rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-primary"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Capacidade
            <input
              name="capacidadeMax"
              type="number"
              min="1"
              defaultValue={10}
              className="w-24 rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-primary"
            />
          </label>
          <button
            type="submit"
            className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-background transition-colors hover:bg-secondary"
          >
            Adicionar horário
          </button>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-surface-border text-left text-xs font-semibold uppercase tracking-wider text-foreground/50">
                <th className="py-2">Modalidade</th>
                <th className="py-2">Dia</th>
                <th className="py-2">Horário</th>
                <th className="py-2">Capacidade</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {aulas.map((aula) => (
                <tr key={aula.id} className="border-b border-surface-border/50">
                  <td className="py-2 text-foreground">{aula.modalidade}</td>
                  <td className="py-2 text-foreground/70">
                    {DIA_SEMANA_LABEL[aula.diaSemana]}
                  </td>
                  <td className="py-2 text-foreground/70">
                    {formatarHora(aula.horarioInicio)}
                  </td>
                  <td className="py-2">
                    <form
                      action={atualizarCapacidadeAula.bind(null, aula.id)}
                      className="flex items-center gap-2"
                    >
                      <input
                        name="capacidadeMax"
                        type="number"
                        min="1"
                        defaultValue={aula.capacidadeMax}
                        className="w-16 rounded-md border border-foreground/20 bg-transparent px-2 py-1 outline-none focus:border-primary"
                      />
                      <button
                        type="submit"
                        className="text-xs text-primary hover:underline"
                      >
                        salvar
                      </button>
                    </form>
                  </td>
                  <td className="py-2 text-right">
                    <form action={excluirAula.bind(null, aula.id)}>
                      <button
                        type="submit"
                        aria-label="Excluir horário"
                        className="text-foreground/40 transition-colors hover:text-error"
                      >
                        <Trash2 size={16} />
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AgendaGrid linhas={linhas} mostrarAlunos almoco={
        configAgenda.almocoInicio && configAgenda.almocoFim
          ? { inicio: configAgenda.almocoInicio, fim: configAgenda.almocoFim }
          : undefined
      } />
    </div>
  );
}
