"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { calcularVencimento } from "@/lib/vencimento";
import { gerarLinkAcesso } from "@/lib/recuperacao-senha";
import { gerarUsernameUnico, criarUsuarioAluno } from "@/lib/acesso-portal";
import { ehContaFixa } from "@/lib/contas-fixas";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function origemAtual() {
  const hdrs = await headers();
  return `${hdrs.get("x-forwarded-proto") ?? "http"}://${hdrs.get("host")}`;
}

function campoOpcional(formData: FormData, nome: string) {
  const valor = String(formData.get(nome) ?? "").trim();
  return valor || null;
}

function dataOpcional(formData: FormData, nome: string) {
  const valor = String(formData.get(nome) ?? "").trim();
  return valor ? new Date(valor) : null;
}

// Lê o pacoteId/descontoPercentual do form e sincroniza o vínculo do aluno
// com um Pacote — "Nenhum" (pacoteId vazio) remove o vínculo existente.
async function sincronizarPacoteAluno(alunoId: string, formData: FormData) {
  const pacoteId = campoOpcional(formData, "pacoteId");

  if (!pacoteId) {
    await prisma.pacoteMembro.deleteMany({ where: { alunoId } });
    return;
  }

  const descontoRaw = String(formData.get("descontoPercentual") ?? "0")
    .trim()
    .replace(",", ".");
  const descontoPercentual = Number(descontoRaw) || 0;

  await prisma.pacoteMembro.upsert({
    where: { alunoId },
    update: { pacoteId, descontoPercentual },
    create: { alunoId, pacoteId, descontoPercentual, titular: false },
  });
}

export async function createAluno(formData: FormData) {
  const nome = String(formData.get("nome") ?? "").trim();
  const modalidade = String(formData.get("modalidade") ?? "").trim();
  const graduacaoFaixa = String(formData.get("graduacaoFaixa") ?? "").trim();
  const statusPagamento = String(formData.get("statusPagamento") ?? "").trim();
  const aptoExame = formData.get("aptoExame") === "on";
  const preCadastroId = campoOpcional(formData, "preCadastroId");
  const agendaAulaReferenciaId = campoOpcional(formData, "agendaAulaReferenciaId");
  const email = campoOpcional(formData, "email")?.toLowerCase() ?? null;

  if (!nome || !modalidade || !graduacaoFaixa || !statusPagamento) {
    throw new Error("Preencha todos os campos obrigatórios.");
  }
  if (!agendaAulaReferenciaId) {
    throw new Error("Escolha um horário pro aluno — não é permitido deixar em aberto.");
  }

  const dataMatricula = new Date();

  const aluno = await prisma.aluno.create({
    data: {
      nome,
      modalidade,
      graduacaoFaixa,
      statusPagamento,
      aptoExame,
      dataMatricula,
      dataVencimento: calcularVencimento(dataMatricula),
      telefone: campoOpcional(formData, "telefone"),
      email,
      cidade: campoOpcional(formData, "cidade"),
      lesoes: campoOpcional(formData, "lesoes"),
      dataNascimento: dataOpcional(formData, "dataNascimento"),
      agendaAulaReferenciaId,
    },
  });

  await sincronizarPacoteAluno(aluno.id, formData);

  if (preCadastroId) {
    await prisma.preCadastro.update({
      where: { id: preCadastroId },
      data: { status: "Aprovado" },
    });
  }

  revalidatePath("/alunos");
  revalidatePath("/pre-cadastros");
  revalidatePath("/configuracoes");

  if (email) {
    const username = await gerarUsernameUnico(nome);
    const link = await criarUsuarioAluno({
      alunoId: aluno.id,
      username,
      email,
      origin: await origemAtual(),
    });
    redirect(
      `/alunos/${aluno.id}/editar?acessoLink=${encodeURIComponent(link)}`,
    );
  }

  redirect("/alunos");
}

export async function updateAluno(id: string, formData: FormData) {
  const nome = String(formData.get("nome") ?? "").trim();
  const modalidade = String(formData.get("modalidade") ?? "").trim();
  const graduacaoFaixa = String(formData.get("graduacaoFaixa") ?? "").trim();
  const statusPagamento = String(formData.get("statusPagamento") ?? "").trim();
  const aptoExame = formData.get("aptoExame") === "on";
  const agendaAulaReferenciaId = campoOpcional(formData, "agendaAulaReferenciaId");

  if (!nome || !modalidade || !graduacaoFaixa || !statusPagamento) {
    throw new Error("Preencha todos os campos obrigatórios.");
  }
  if (!agendaAulaReferenciaId) {
    throw new Error("Escolha um horário pro aluno — não é permitido deixar em aberto.");
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
      dataVencimento: dataOpcional(formData, "dataVencimento"),
      agendaAulaReferenciaId,
    },
  });

  await sincronizarPacoteAluno(id, formData);

  revalidatePath("/alunos");
  revalidatePath("/aluno/financeiro");
  revalidatePath("/configuracoes");
  redirect("/alunos");
}

export async function atualizarVencimentoMatricula(matriculaId: string, formData: FormData) {
  const dataVencimentoBase = dataOpcional(formData, "dataVencimentoBase");
  if (!dataVencimentoBase) {
    throw new Error("Informe a data de vencimento.");
  }

  const matricula = await prisma.matricula.update({
    where: { id: matriculaId },
    data: { dataVencimentoBase },
    select: { alunoId: true },
  });

  revalidatePath(`/alunos/${matricula.alunoId}/editar`);
  revalidatePath("/aluno/financeiro");
}

export async function deleteAluno(id: string) {
  const aluno = await prisma.aluno.findUnique({
    where: { id },
    include: { usuario: true },
  });

  if (ehContaFixa(aluno?.usuario?.username)) {
    throw new Error(
      "Este aluno é uma conta fixa de teste/suporte do sistema e não pode ser excluída.",
    );
  }

  await prisma.aluno.delete({ where: { id } });
  revalidatePath("/alunos");
}

export async function criarAcessoAluno(alunoId: string, formData: FormData) {
  const username = String(formData.get("username") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (!username || !email) {
    throw new Error("Informe usuário e e-mail para criar o acesso.");
  }

  const link = await criarUsuarioAluno({
    alunoId,
    username,
    email,
    origin: await origemAtual(),
  });

  revalidatePath(`/alunos/${alunoId}/editar`);
  redirect(
    `/alunos/${alunoId}/editar?acessoLink=${encodeURIComponent(link)}`,
  );
}

export async function reenviarAcessoAluno(alunoId: string) {
  const aluno = await prisma.aluno.findUnique({
    where: { id: alunoId },
    include: { usuario: true },
  });

  if (!aluno?.usuario) {
    throw new Error("Este aluno ainda não tem acesso ao portal.");
  }

  const link = await gerarLinkAcesso(aluno.usuario.id, await origemAtual());

  redirect(
    `/alunos/${alunoId}/editar?acessoLink=${encodeURIComponent(link)}`,
  );
}

export async function revogarAcessoAluno(alunoId: string) {
  const usuario = await prisma.usuario.findUnique({ where: { alunoId } });

  if (ehContaFixa(usuario?.username)) {
    throw new Error(
      "Este acesso é uma conta fixa de teste/suporte do sistema e não pode ser revogado.",
    );
  }

  await prisma.usuario.deleteMany({ where: { alunoId } });
  revalidatePath(`/alunos/${alunoId}/editar`);
  redirect(`/alunos/${alunoId}/editar`);
}
