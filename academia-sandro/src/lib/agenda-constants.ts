// Constantes/tipos puros da agenda — sem import de Prisma, seguro pra client components.

export const DIA_SEMANA_LABEL: Record<string, string> = {
  SEGUNDA: "Segunda",
  TERCA: "Terça",
  QUARTA: "Quarta",
  QUINTA: "Quinta",
  SEXTA: "Sexta",
  SABADO: "Sábado",
  DOMINGO: "Domingo",
};

export const DIAS_GRADE = [
  "SEGUNDA",
  "TERCA",
  "QUARTA",
  "QUINTA",
  "SEXTA",
  "SABADO",
] as const;

export function formatarHora(hora: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(hora);
}

export type HorarioResumo = {
  id: string;
  modalidade: string;
  diaSemana: string;
  hora: string;
};

export type AlunoResumo = { id: string; nome: string; pendente?: boolean };

export type CelulaAgenda = {
  id: string;
  hora: string;
  vagas: number;
  capacidadeMax: number;
  roster: AlunoResumo[];
};

export type LinhaAgenda = {
  modalidade: string;
  porDia: Partial<Record<string, CelulaAgenda[]>>;
};

export type CelulaMatricula = CelulaAgenda & { matriculado: boolean };
export type LinhaMatricula = {
  modalidade: string;
  porDia: Partial<Record<string, CelulaMatricula[]>>;
};
