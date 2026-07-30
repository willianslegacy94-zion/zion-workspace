import { prisma } from "@/lib/prisma";
import { formatarHora } from "@/lib/agenda-constants";

const SINGLETON_ID = "singleton";

export type ConfiguracaoAgendaResumo = {
  almocoInicio: string | null;
  almocoFim: string | null;
};

export async function getConfiguracaoAgenda(): Promise<ConfiguracaoAgendaResumo> {
  const config = await prisma.configuracaoAgenda.findUnique({
    where: { id: SINGLETON_ID },
  });

  return {
    almocoInicio: config?.almocoInicio ? formatarHora(config.almocoInicio) : null,
    almocoFim: config?.almocoFim ? formatarHora(config.almocoFim) : null,
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
