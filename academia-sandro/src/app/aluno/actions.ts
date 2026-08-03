"use server";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { matricularAlunoEmAula, MatriculaError } from "@/lib/matricula";

// Alunos dependentes de um pacote FAMILIA não têm login próprio — o titular
// consegue agir em nome deles (anexar comprovante) a partir do login dele.
async function alunoIdsAcessiveisDaSessao(): Promise<string[]> {
  const session = await auth();
  const alunoId = session?.user?.alunoId;
  if (!alunoId) {
    throw new Error("Usuário não vinculado a um cadastro de aluno.");
  }

  const membro = await prisma.pacoteMembro.findUnique({
    where: { alunoId },
    include: { pacote: { include: { membros: true } } },
  });

  if (membro?.pacote.tipo === "FAMILIA" && membro.titular) {
    return membro.pacote.membros.map((m) => m.alunoId);
  }

  return [alunoId];
}

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

  const alunoIdsAcessiveis = await alunoIdsAcessiveisDaSessao();
  const transacao = await prisma.transacaoFinanceira.findFirst({
    where: { id: transacaoId, alunoId: { in: alunoIdsAcessiveis } },
  });
  if (!transacao) {
    throw new Error("Cobrança não encontrada.");
  }

  const extensao = path.extname(arquivo.name) || "";
  const nomeArquivo = `${transacao.alunoId}-${Date.now()}${extensao}`;
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

  try {
    await matricularAlunoEmAula(alunoId, agendaAulaId, formaPagamento);
  } catch (error) {
    if (error instanceof MatriculaError) {
      throw new Error(error.message);
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
