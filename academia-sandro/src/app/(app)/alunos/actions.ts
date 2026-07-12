"use server";

import { prisma } from "@/lib/prisma";
import { calcularVencimento } from "@/lib/vencimento";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function campoOpcional(formData: FormData, nome: string) {
  const valor = String(formData.get(nome) ?? "").trim();
  return valor || null;
}

function dataOpcional(formData: FormData, nome: string) {
  const valor = String(formData.get(nome) ?? "").trim();
  return valor ? new Date(valor) : null;
}

export async function createAluno(formData: FormData) {
  const nome = String(formData.get("nome") ?? "").trim();
  const modalidade = String(formData.get("modalidade") ?? "").trim();
  const graduacaoFaixa = String(formData.get("graduacaoFaixa") ?? "").trim();
  const statusPagamento = String(formData.get("statusPagamento") ?? "").trim();
  const aptoExame = formData.get("aptoExame") === "on";
  const preCadastroId = campoOpcional(formData, "preCadastroId");

  if (!nome || !modalidade || !graduacaoFaixa || !statusPagamento) {
    throw new Error("Preencha todos os campos obrigatórios.");
  }

  const dataMatricula = new Date();

  await prisma.aluno.create({
    data: {
      nome,
      modalidade,
      graduacaoFaixa,
      statusPagamento,
      aptoExame,
      dataMatricula,
      dataVencimento: calcularVencimento(dataMatricula),
      telefone: campoOpcional(formData, "telefone"),
      email: campoOpcional(formData, "email"),
      cidade: campoOpcional(formData, "cidade"),
      lesoes: campoOpcional(formData, "lesoes"),
      dataNascimento: dataOpcional(formData, "dataNascimento"),
    },
  });

  if (preCadastroId) {
    await prisma.preCadastro.update({
      where: { id: preCadastroId },
      data: { status: "Aprovado" },
    });
  }

  revalidatePath("/alunos");
  revalidatePath("/pre-cadastros");
}

export async function updateAluno(id: string, formData: FormData) {
  const nome = String(formData.get("nome") ?? "").trim();
  const modalidade = String(formData.get("modalidade") ?? "").trim();
  const graduacaoFaixa = String(formData.get("graduacaoFaixa") ?? "").trim();
  const statusPagamento = String(formData.get("statusPagamento") ?? "").trim();
  const aptoExame = formData.get("aptoExame") === "on";

  if (!nome || !modalidade || !graduacaoFaixa || !statusPagamento) {
    throw new Error("Preencha todos os campos obrigatórios.");
  }

  await prisma.aluno.update({
    where: { id },
    data: {
      nome,
      modalidade,
      graduacaoFaixa,
      statusPagamento,
      aptoExame,
      telefone: campoOpcional(formData, "telefone"),
      email: campoOpcional(formData, "email"),
      cidade: campoOpcional(formData, "cidade"),
      lesoes: campoOpcional(formData, "lesoes"),
      dataNascimento: dataOpcional(formData, "dataNascimento"),
    },
  });

  revalidatePath("/alunos");
  redirect("/alunos");
}

export async function deleteAluno(id: string) {
  await prisma.aluno.delete({ where: { id } });
  revalidatePath("/alunos");
}
