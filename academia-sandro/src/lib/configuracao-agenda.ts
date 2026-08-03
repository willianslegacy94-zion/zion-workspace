import { prisma } from "@/lib/prisma";
import { formatarHora } from "@/lib/agenda-constants";

const SINGLETON_ID = "singleton";

// Almoço nunca pode ficar "sem configurar" — antes do admin abrir a aba
// Agenda pela 1ª vez (singleton ainda não existe), cai nesse default em vez
// de null/null, senão caiNoAlmoco() não bloqueia nada e dá pra criar aula
// bem no meio do almoço logo no primeiro deploy.
const ALMOCO_DEFAULT = { almocoInicio: "12:00", almocoFim: "13:00" } as const;

export type ConfiguracaoAgendaResumo = {
  almocoInicio: string | null;
  almocoFim: string | null;
};

export async function getConfiguracaoAgenda(): Promise<ConfiguracaoAgendaResumo> {
  const config = await prisma.configuracaoAgenda.findUnique({
    where: { id: SINGLETON_ID },
  });

  if (!config) return { ...ALMOCO_DEFAULT };

  return {
    almocoInicio: config.almocoInicio ? formatarHora(config.almocoInicio) : null,
    almocoFim: config.almocoFim ? formatarHora(config.almocoFim) : null,
  };
}

export async function salvarAlmoco(horaInicio: string, horaFim: string) {
  await prisma.configuracaoAgenda.upsert({
    where: { id: SINGLETON_ID },
    update: { almocoInicio: horaParaData(horaInicio), almocoFim: horaParaData(horaFim) },
    create: {
      id: SINGLETON_ID,
      almocoInicio: horaParaData(horaInicio),
      almocoFim: horaParaData(horaFim),
    },
  });
}

// Compara só a parte de hora — horarioInicio de AgendaAula sempre cai em 1970-01-01.
export function caiNoAlmoco(
  horarioInicio: Date,
  config: ConfiguracaoAgendaResumo,
): boolean {
  if (!config.almocoInicio || !config.almocoFim) return false;

  const hora = formatarHora(horarioInicio);
  return hora >= config.almocoInicio && hora < config.almocoFim;
}

export function horaParaData(hora: string): Date {
  return new Date(`1970-01-01T${hora}:00.000Z`);
}
