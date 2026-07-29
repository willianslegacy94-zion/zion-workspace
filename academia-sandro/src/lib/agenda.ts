import { prisma } from "@/lib/prisma";
import {
  formatarHora,
  type HorarioResumo,
  type AlunoResumo,
  type LinhaAgenda,
  type LinhaMatricula,
} from "@/lib/agenda-constants";

export {
  DIA_SEMANA_LABEL,
  DIAS_GRADE,
  formatarHora,
  type HorarioResumo,
  type AlunoResumo,
  type CelulaAgenda,
  type LinhaAgenda,
  type CelulaMatricula,
  type LinhaMatricula,
} from "@/lib/agenda-constants";

// Lista leve pra selects de "escolha o horário" (cadastro de aluno, etc.)
export async function getHorariosParaSelecao(): Promise<HorarioResumo[]> {
  const aulas = await prisma.agendaAula.findMany({
    orderBy: [{ modalidade: "asc" }, { diaSemana: "asc" }, { horarioInicio: "asc" }],
    select: { id: true, modalidade: true, diaSemana: true, horarioInicio: true },
  });

  return aulas.map((aula) => ({
    id: aula.id,
    modalidade: aula.modalidade,
    diaSemana: aula.diaSemana,
    hora: formatarHora(aula.horarioInicio),
  }));
}

// Um aluno tem acesso implícito a todos os horários da própria modalidade
// (Aluno.modalidade). Matrícula é só pra modalidades extras.
export async function getAgendaGrade(): Promise<LinhaAgenda[]> {
  const [aulas, alunos] = await Promise.all([
    prisma.agendaAula.findMany({
      include: {
        matriculas: {
          include: {
            aluno: { select: { id: true, nome: true } },
            transacao: { select: { confirmadoEm: true } },
          },
        },
      },
      orderBy: [{ modalidade: "asc" }, { horarioInicio: "asc" }],
    }),
    prisma.aluno.findMany({ select: { id: true, nome: true, modalidade: true } }),
  ]);

  const porModalidade = new Map<string, LinhaAgenda>();

  for (const aula of aulas) {
    if (!porModalidade.has(aula.modalidade)) {
      porModalidade.set(aula.modalidade, {
        modalidade: aula.modalidade,
        porDia: {},
      });
    }
    const linha = porModalidade.get(aula.modalidade)!;
    const celulas = linha.porDia[aula.diaSemana] ?? [];

    const roster = new Map<string, AlunoResumo>();
    for (const aluno of alunos) {
      if (aluno.modalidade === aula.modalidade) {
        roster.set(aluno.id, { id: aluno.id, nome: aluno.nome });
      }
    }
    for (const matricula of aula.matriculas) {
      roster.set(matricula.aluno.id, {
        id: matricula.aluno.id,
        nome: matricula.aluno.nome,
        pendente: !matricula.transacao?.confirmadoEm,
      });
    }

    celulas.push({
      id: aula.id,
      hora: formatarHora(aula.horarioInicio),
      vagas: aula.capacidadeMax - roster.size,
      capacidadeMax: aula.capacidadeMax,
      roster: Array.from(roster.values()),
    });
    linha.porDia[aula.diaSemana] = celulas;
  }

  return Array.from(porModalidade.values());
}

// Agenda pessoal do aluno: a linha inteira da modalidade principal, mais só
// as células específicas de modalidades extras em que ele se matriculou —
// e, pra essas, só depois que o pagamento for confirmado pelo admin.
export async function getMeusHorarios(alunoId: string): Promise<LinhaAgenda[]> {
  const [aluno, linhas] = await Promise.all([
    prisma.aluno.findUnique({ where: { id: alunoId }, select: { modalidade: true } }),
    getAgendaGrade(),
  ]);

  const resultado: LinhaAgenda[] = [];
  for (const linha of linhas) {
    if (linha.modalidade === aluno?.modalidade) {
      resultado.push(linha);
      continue;
    }

    const porDia: LinhaAgenda["porDia"] = {};
    for (const [dia, celulas] of Object.entries(linha.porDia)) {
      const matriculadas = (celulas ?? []).filter((celula) => {
        const entrada = celula.roster.find((a) => a.id === alunoId);
        return entrada && !entrada.pendente;
      });
      if (matriculadas.length > 0) {
        porDia[dia] = matriculadas;
      }
    }
    if (Object.keys(porDia).length > 0) {
      resultado.push({ modalidade: linha.modalidade, porDia });
    }
  }

  return resultado;
}

// Horários de modalidades diferentes da principal do aluno, pra ele se
// matricular como modalidade extra (respeitando o limite de vagas).
export async function getAgendaParaMatricula(
  alunoId: string,
): Promise<LinhaMatricula[]> {
  const [aluno, linhas] = await Promise.all([
    prisma.aluno.findUnique({ where: { id: alunoId }, select: { modalidade: true } }),
    getAgendaGrade(),
  ]);

  return linhas
    .filter((linha) => linha.modalidade !== aluno?.modalidade)
    .map((linha) => ({
      modalidade: linha.modalidade,
      porDia: Object.fromEntries(
        Object.entries(linha.porDia).map(([dia, celulas]) => [
          dia,
          (celulas ?? []).map((celula) => ({
            ...celula,
            matriculado: celula.roster.some((a) => a.id === alunoId),
          })),
        ]),
      ),
    }));
}
