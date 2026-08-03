import { prisma } from "@/lib/prisma";

type TransacaoClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
type PrismaClienteOuTx = typeof prisma | TransacaoClient;

export class MatriculaError extends Error {}

// Matricula um aluno num horário extra: checa capacidade, cria a Matricula e
// a TransacaoFinanceira correspondente (preço da modalidade extra). Recebe
// opcionalmente o client de uma transação em andamento (`tx`), pra poder ser
// chamado tanto isolado (self-service em /aluno/matricula) quanto composto
// dentro de uma transação maior (ex: autocadastro com várias modalidades).
export async function matricularAlunoEmAula(
  alunoId: string,
  agendaAulaId: string,
  formaPagamento: string | undefined,
  client: PrismaClienteOuTx = prisma,
) {
  const aula = await client.agendaAula.findUnique({
    where: { id: agendaAulaId },
  });
  if (!aula) {
    throw new MatriculaError("Horário não encontrado.");
  }

  const aluno = await client.aluno.findUnique({
    where: { id: alunoId },
    select: { modalidade: true },
  });
  if (aluno?.modalidade === aula.modalidade) {
    throw new MatriculaError(
      "Você já tem acesso a este horário pela sua modalidade principal.",
    );
  }

  const [alunosPrimarios, matriculas] = await Promise.all([
    client.aluno.count({ where: { modalidade: aula.modalidade } }),
    client.matricula.count({ where: { agendaAulaId } }),
  ]);
  if (alunosPrimarios + matriculas >= aula.capacidadeMax) {
    throw new MatriculaError("Horário lotado.");
  }

  const precoModalidade = await client.modalidadePreco.findUnique({
    where: { modalidade: aula.modalidade },
  });
  const valor = precoModalidade?.valor ?? 0;

  try {
    const matricula = await client.matricula.create({
      data: { alunoId, agendaAulaId },
    });
    await client.transacaoFinanceira.create({
      data: {
        tipo: "Receita",
        categoria: `Matrícula extra — ${aula.modalidade}`,
        valor,
        alunoId,
        matriculaId: matricula.id,
        formaPagamento: formaPagamento || null,
        dataVencimento: new Date(),
      },
    });
    return { modalidade: aula.modalidade };
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      throw new MatriculaError("Você já está matriculado neste horário.");
    }
    throw error;
  }
}
