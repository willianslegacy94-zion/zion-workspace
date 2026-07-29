import { prisma } from "@/lib/prisma";
import { diasParaVencer } from "@/lib/vencimento";

export type AlertaAluno = {
  id: string;
  nome: string;
  telefone: string | null;
  dias: number;
  novo: boolean;
};

export type AlertaSimples = {
  id: string;
  titulo: string;
  novo: boolean;
};

export type Alertas = {
  inadimplentes: AlertaAluno[];
  vencendo: AlertaAluno[];
  preCadastros: AlertaSimples[];
  novasMatriculas: AlertaSimples[];
  naoLidos: number;
};

// "Novo" = o gatilho do alerta aconteceu depois da última vez que o admin
// marcou como lido. Cada categoria tem seu próprio instante de gatilho —
// pré-cadastro/matrícula é quando foram criados; vencimento/inadimplência
// é quando a data cruzou o limiar (d-3 ou o próprio vencimento).
export async function getAlertas(alertasLidosEm: Date | null): Promise<Alertas> {
  const ehNovo = (gatilho: Date) => !alertasLidosEm || gatilho > alertasLidosEm;

  const [alunosComVencimento, preCadastros, matriculas] = await Promise.all([
    prisma.aluno.findMany({
      where: { dataVencimento: { not: null } },
      select: { id: true, nome: true, telefone: true, dataVencimento: true },
    }),
    prisma.preCadastro.findMany({
      where: { status: "Pendente" },
      select: { id: true, nome: true, criadoEm: true },
      orderBy: { criadoEm: "desc" },
    }),
    prisma.matricula.findMany({
      where: {
        transacao: { comprovanteUrl: { not: null }, confirmadoEm: null },
      },
      select: {
        id: true,
        criadoEm: true,
        aluno: { select: { nome: true } },
        agendaAula: { select: { modalidade: true } },
      },
      orderBy: { criadoEm: "desc" },
    }),
  ]);

  const inadimplentes: AlertaAluno[] = [];
  const vencendo: AlertaAluno[] = [];

  for (const aluno of alunosComVencimento) {
    const dataVencimento = aluno.dataVencimento as Date;
    const dias = diasParaVencer(dataVencimento);

    // Zera hora pra comparar por dia, igual diasParaVencer já faz — sem isso,
    // um vencimento com horário tardio podia ficar "novo" indefinidamente.
    const vencimentoNoDia = new Date(dataVencimento);
    vencimentoNoDia.setHours(0, 0, 0, 0);

    if (dias < 0) {
      inadimplentes.push({
        id: aluno.id,
        nome: aluno.nome,
        telefone: aluno.telefone,
        dias,
        novo: ehNovo(vencimentoNoDia),
      });
    } else if (dias <= 3) {
      const gatilho = new Date(vencimentoNoDia);
      gatilho.setDate(gatilho.getDate() - 3);
      vencendo.push({
        id: aluno.id,
        nome: aluno.nome,
        telefone: aluno.telefone,
        dias,
        novo: ehNovo(gatilho),
      });
    }
  }
  inadimplentes.sort((a, b) => a.dias - b.dias);
  vencendo.sort((a, b) => a.dias - b.dias);

  const preCadastrosAlertas: AlertaSimples[] = preCadastros.map((pc) => ({
    id: pc.id,
    titulo: pc.nome,
    novo: ehNovo(pc.criadoEm),
  }));

  const novasMatriculasAlertas: AlertaSimples[] = matriculas.map((m) => ({
    id: m.id,
    titulo: `${m.aluno.nome} — ${m.agendaAula.modalidade}`,
    novo: ehNovo(m.criadoEm),
  }));

  const naoLidos =
    inadimplentes.filter((a) => a.novo).length +
    vencendo.filter((a) => a.novo).length +
    preCadastrosAlertas.filter((a) => a.novo).length +
    novasMatriculasAlertas.filter((a) => a.novo).length;

  return {
    inadimplentes,
    vencendo,
    preCadastros: preCadastrosAlertas,
    novasMatriculas: novasMatriculasAlertas,
    naoLidos,
  };
}
