"use server";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function anexarComprovante(transacaoId: string, formData: FormData) {
  const session = await auth();
  const alunoId = session?.user?.alunoId;
  if (!alunoId) {
    throw new Error("Usuário não vinculado a um cadastro de aluno.");
  }

  const arquivo = formData.get("comprovante");
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    throw new Error("Selecione um arquivo para anexar.");
  }

  const transacao = await prisma.transacaoFinanceira.findFirst({
    where: { id: transacaoId, alunoId },
  });
  if (!transacao) {
    throw new Error("Cobrança não encontrada.");
  }

  const extensao = path.extname(arquivo.name) || "";
  const nomeArquivo = `${alunoId}-${Date.now()}${extensao}`;
  const pastaDestino = path.join(process.cwd(), "public", "comprovantes");
  await mkdir(pastaDestino, { recursive: true });
  await writeFile(
    path.join(pastaDestino, nomeArquivo),
    Buffer.from(await arquivo.arrayBuffer()),
  );

  await prisma.transacaoFinanceira.update({
    where: { id: transacao.id },
    data: {
      comprovanteUrl: `/comprovantes/${nomeArquivo}`,
      comprovanteEnviadoEm: new Date(),
    },
  });

  revalidatePath("/aluno");
  revalidatePath("/aluno/financeiro");
}

async function alunoIdDaSessao() {
  const session = await auth();
  const alunoId = session?.user?.alunoId;
  if (!alunoId) {
    throw new Error("Usuário não vinculado a um cadastro de aluno.");
  }
  return alunoId;
}

export async function matricularEmAula(
  agendaAulaId: string,
  formaPagamento: string,
) {
  const alunoId = await alunoIdDaSessao();

  const aula = await prisma.agendaAula.findUnique({
    where: { id: agendaAulaId },
  });
  if (!aula) {
    throw new Error("Horário não encontrado.");
  }

  const aluno = await prisma.aluno.findUnique({
    where: { id: alunoId },
    select: { modalidade: true },
  });
  if (aluno?.modalidade === aula.modalidade) {
    throw new Error("Você já tem acesso a este horário pela sua modalidade principal.");
  }

  const [alunosPrimarios, matriculas] = await Promise.all([
    prisma.aluno.count({ where: { modalidade: aula.modalidade } }),
    prisma.matricula.count({ where: { agendaAulaId } }),
  ]);
  if (alunosPrimarios + matriculas >= aula.capacidadeMax) {
    throw new Error("Horário lotado.");
  }

  const precoModalidade = await prisma.modalidadePreco.findUnique({
    where: { modalidade: aula.modalidade },
  });
  const valor = precoModalidade?.valor ?? 0;

  try {
    await prisma.$transaction(async (tx) => {
      const matricula = await tx.matricula.create({
        data: { alunoId, agendaAulaId },
      });
      await tx.transacaoFinanceira.create({
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
    });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      throw new Error("Você já está matriculado neste horário.");
    }
    throw error;
  }

  revalidatePath("/aluno/matricula");
  revalidatePath("/aluno");
  revalidatePath("/aluno/financeiro");
  revalidatePath("/agenda");
  revalidatePath("/transacoes");
  revalidatePath("/matriculas");
}

export async function cancelarMatricula(agendaAulaId: string) {
  const alunoId = await alunoIdDaSessao();

  await prisma.matricula.deleteMany({ where: { alunoId, agendaAulaId } });

  revalidatePath("/aluno/matricula");
  revalidatePath("/aluno");
  revalidatePath("/agenda");
  revalidatePath("/matriculas");
}
