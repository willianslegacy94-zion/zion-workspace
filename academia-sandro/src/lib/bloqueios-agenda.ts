import { prisma } from "@/lib/prisma";
import { formatarHora } from "@/lib/agenda-constants";

export type BloqueioResumo = {
  id: string;
  data: Date;
  dataFormatada: string;
  horaInicio: string;
  horaFim: string;
  motivo: string | null;
};

function inicioDoDia(data: Date) {
  const copia = new Date(data);
  copia.setHours(0, 0, 0, 0);
  return copia;
}

function formatarBloqueio(bloqueio: {
  id: string;
  data: Date;
  horaInicio: Date;
  horaFim: Date;
  motivo: string | null;
}): BloqueioResumo {
  return {
    id: bloqueio.id,
    data: bloqueio.data,
    dataFormatada: new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(
      bloqueio.data,
    ),
    horaInicio: formatarHora(bloqueio.horaInicio),
    horaFim: formatarHora(bloqueio.horaFim),
    motivo: bloqueio.motivo,
  };
}

// Todos os bloqueios de hoje em diante — usado na tela de gestão em /agenda.
export async function getBloqueiosFuturos(): Promise<BloqueioResumo[]> {
  const bloqueios = await prisma.bloqueioAgenda.findMany({
    where: { data: { gte: inicioDoDia(new Date()) } },
    orderBy: [{ data: "asc" }, { horaInicio: "asc" }],
  });

  return bloqueios.map(formatarBloqueio);
}

// Subconjunto dentro de uma janela de dias — usado no banner de aviso em /aluno.
export async function getBloqueiosProximos(dias = 14): Promise<BloqueioResumo[]> {
  const hoje = inicioDoDia(new Date());
  const limite = new Date(hoje);
  limite.setDate(limite.getDate() + dias);

  const bloqueios = await prisma.bloqueioAgenda.findMany({
    where: { data: { gte: hoje, lte: limite } },
    orderBy: [{ data: "asc" }, { horaInicio: "asc" }],
  });

  return bloqueios.map(formatarBloqueio);
}
