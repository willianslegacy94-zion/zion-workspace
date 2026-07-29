"use server";

import { prisma } from "@/lib/prisma";
import { calcularVencimento } from "@/lib/vencimento";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createTransacao(formData: FormData) {
  const tipo = String(formData.get("tipo") ?? "").trim();
  const categoria = String(formData.get("categoria") ?? "").trim();
  const valor = String(formData.get("valor") ?? "").trim();
  const dataTransacao = String(formData.get("dataTransacao") ?? "").trim();
  const dataVencimento = String(formData.get("dataVencimento") ?? "").trim();
  const alunoId = String(formData.get("alunoId") ?? "").trim();

  if (!tipo || !categoria || !valor || !dataTransacao) {
    throw new Error("Preencha todos os campos obrigatórios.");
  }

  const dataTransacaoDate = new Date(dataTransacao);

  await prisma.transacaoFinanceira.create({
    data: {
      tipo,
      categoria,
      valor,
      dataTransacao: dataTransacaoDate,
      dataVencimento: dataVencimento ? new Date(dataVencimento) : null,
      alunoId: alunoId || null,
    },
  });

  if (tipo === "Receita" && alunoId) {
    await prisma.aluno.update({
      where: { id: alunoId },
      data: { dataVencimento: calcularVencimento(dataTransacaoDate) },
    });
  }

  revalidatePath("/transacoes");
  revalidatePath("/alunos");
}

export async function updateTransacao(id: string, formData: FormData) {
  const tipo = String(formData.get("tipo") ?? "").trim();
  const categoria = String(formData.get("categoria") ?? "").trim();
  const valor = String(formData.get("valor") ?? "").trim();
  const dataTransacao = String(formData.get("dataTransacao") ?? "").trim();
  const dataVencimento = String(formData.get("dataVencimento") ?? "").trim();
  const formaPagamento = String(formData.get("formaPagamento") ?? "").trim();
  const alunoId = String(formData.get("alunoId") ?? "").trim();

  if (!tipo || !categoria || !valor || !dataTransacao) {
    throw new Error("Preencha todos os campos obrigatórios.");
  }

  await prisma.transacaoFinanceira.update({
    where: { id },
    data: {
      tipo,
      categoria,
      valor,
      dataTransacao: new Date(dataTransacao),
      dataVencimento: dataVencimento ? new Date(dataVencimento) : null,
      formaPagamento: formaPagamento || null,
      alunoId: alunoId || null,
    },
  });

  revalidatePath("/transacoes");
  redirect("/transacoes");
}

export async function deleteTransacao(id: string) {
  await prisma.transacaoFinanceira.delete({ where: { id } });
  revalidatePath("/transacoes");
}

export async function confirmarPagamento(id: string) {
  const transacao = await prisma.transacaoFinanceira.findUnique({
    where: { id },
  });
  if (!transacao) {
    throw new Error("Transação não encontrada.");
  }
  if (!transacao.comprovanteUrl) {
    throw new Error("Essa transação ainda não tem comprovante anexado.");
  }

  await prisma.transacaoFinanceira.update({
    where: { id },
    data: { confirmadoEm: new Date() },
  });

  if (transacao.tipo === "Receita" && transacao.alunoId) {
    await prisma.aluno.update({
      where: { id: transacao.alunoId },
      data: { statusPagamento: "Em dia" },
    });
  }

  revalidatePath("/transacoes");
  revalidatePath("/matriculas");
  revalidatePath("/alunos");
  revalidatePath("/agenda");
}
