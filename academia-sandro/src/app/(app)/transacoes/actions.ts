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
