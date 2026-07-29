import { CalendarClock, Tag } from "lucide-react";
import { getAgendaGrade } from "@/lib/agenda";
import { getPrecosModalidade } from "@/lib/precos";
import { AgendaGrid } from "@/components/AgendaGrid";
import { PageHeader } from "@/components/PageHeader";
import { salvarPrecosModalidade } from "./actions";

export default async function AgendaPage() {
  const [linhas, precos] = await Promise.all([
    getAgendaGrade(),
    getPrecosModalidade(),
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

      <AgendaGrid linhas={linhas} mostrarAlunos />
    </div>
  );
}
