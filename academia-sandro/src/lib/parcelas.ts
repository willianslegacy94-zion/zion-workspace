import { prisma } from "@/lib/prisma";

const TOTAL_MESES = 12;

export type StatusParcela =
  | "Paga"
  | "Aguardando confirmação"
  | "Pendente"
  | "A vencer"
  | "Não paga";

export type Parcela = {
  mes: Date;
  status: StatusParcela;
  transacaoId: string | null;
  valor: number | null;
  comprovanteUrl: string | null;
};

// Janela fixa de 12 meses a partir de uma data-base — não é "próximos 12
// meses a partir de hoje", é sempre a mesma janela ancorada na data-base.
// `matriculaId: null` = mensalidade principal; um id específico = ciclo
// próprio de uma modalidade extra (ver Matricula.dataVencimentoBase).
export async function getParcelasCiclo(params: {
  alunoId: string;
  matriculaId: string | null;
  dataBase: Date;
}): Promise<Parcela[]> {
  const { alunoId, matriculaId, dataBase } = params;

  const transacoes = await prisma.transacaoFinanceira.findMany({
    where: { alunoId, tipo: "Receita", matriculaId },
    select: {
      id: true,
      valor: true,
      dataTransacao: true,
      comprovanteUrl: true,
      confirmadoEm: true,
    },
  });

  const hoje = new Date();
  const parcelas: Parcela[] = [];

  for (let i = 0; i < TOTAL_MESES; i++) {
    const mesRef = new Date(dataBase.getFullYear(), dataBase.getMonth() + i, 1);

    const transacao = transacoes.find(
      (t) =>
        t.dataTransacao.getFullYear() === mesRef.getFullYear() &&
        t.dataTransacao.getMonth() === mesRef.getMonth(),
    );

    let status: StatusParcela;
    if (transacao?.confirmadoEm) {
      status = "Paga";
    } else if (transacao?.comprovanteUrl) {
      status = "Aguardando confirmação";
    } else if (transacao) {
      status = "Pendente";
    } else if (mesRef > hoje) {
      status = "A vencer";
    } else {
      status = "Não paga";
    }

    parcelas.push({
      mes: mesRef,
      status,
      transacaoId: transacao?.id ?? null,
      valor: transacao ? Number(transacao.valor) : null,
      comprovanteUrl: transacao?.comprovanteUrl ?? null,
    });
  }

  return parcelas;
}

// Mensalidade principal — mantido como atalho pro caso mais comum
// (matriculaId: null, ancorado em Aluno.dataMatricula).
export async function getParcelas(alunoId: string): Promise<Parcela[]> {
  const aluno = await prisma.aluno.findUnique({
    where: { id: alunoId },
    select: { dataMatricula: true },
  });
  if (!aluno) return [];

  return getParcelasCiclo({ alunoId, matriculaId: null, dataBase: aluno.dataMatricula });
}
