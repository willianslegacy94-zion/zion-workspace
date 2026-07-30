import Link from "next/link";
import { CalendarClock, Settings } from "lucide-react";
import { getAgendaGrade } from "@/lib/agenda";
import { getConfiguracaoAgenda } from "@/lib/configuracao-agenda";
import { AgendaGrid } from "@/components/AgendaGrid";
import { PageHeader } from "@/components/PageHeader";

export default async function AgendaPage() {
  const [linhas, configAgenda] = await Promise.all([
    getAgendaGrade(),
    getConfiguracaoAgenda(),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-12">
      <PageHeader
        icon={CalendarClock}
        title="Agenda"
        subtitle="Grade de horários por modalidade"
      />

      <Link
        href="/configuracoes?aba=agenda"
        className="flex w-fit items-center gap-2 rounded-lg border border-foreground/10 px-4 py-2.5 text-sm text-foreground/60 transition-colors hover:border-primary/30 hover:text-primary"
      >
        <Settings size={15} />
        Gerencie horários, preços, almoço e bloqueios em Configurações → Agenda
      </Link>

      <AgendaGrid
        linhas={linhas}
        mostrarAlunos
        almoco={
          configAgenda.almocoInicio && configAgenda.almocoFim
            ? { inicio: configAgenda.almocoInicio, fim: configAgenda.almocoFim }
            : undefined
        }
      />
    </div>
  );
}
