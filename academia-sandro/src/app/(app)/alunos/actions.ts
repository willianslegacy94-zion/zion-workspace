"use server";

import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { calcularVencimento } from "@/lib/vencimento";
import { gerarLinkAcesso } from "@/lib/recuperacao-senha";
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

async function gerarUsernameUnico(nome: string): Promise<string> {
  const partes = nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .split(/\s+/);
  const base = `${partes[0]}.${partes[partes.length - 1]}`;

  let candidato = base;
  let sufixo = 1;
  while (await prisma.usuario.findUnique({ where: { username: candidato } })) {
    sufixo++;
    candidato = `${base}${sufixo}`;
  }
  return candidato;
}

async function criarUsuarioAluno({
  alunoId,
  username,
  email,
}: {
  alunoId: string;
  username: string;
  email: string;
}) {
  const senhaAleatoria = crypto.randomBytes(24).toString("hex");
  const passwordHash = await bcrypt.hash(senhaAleatoria, 12);

  const usuario = await prisma.usuario.create({
    data: {
      username,
      email,
      passwordHash,
      role: "ALUNO",
      senhaTemporaria: true,
      alunoId,
    },
  });

  return gerarLinkAcesso(usuario.id, await origemAtual());
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

  if (preCadastroId) {
    await prisma.preCadastro.update({
      where: { id: preCadastroId },
      data: { status: "Aprovado" },
    });
  }

  revalidatePath("/alunos");
  revalidatePath("/pre-cadastros");

  if (email) {
    const username = await gerarUsernameUnico(nome);
    const link = await criarUsuarioAluno({ alunoId: aluno.id, username, email });
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
      agendaAulaReferenciaId: campoOpcional(formData, "agendaAulaReferenciaId"),
    },
  });

  revalidatePath("/alunos");
  redirect("/alunos");
}

export async function deleteAluno(id: string) {
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

  const link = await criarUsuarioAluno({ alunoId, username, email });

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
  await prisma.usuario.deleteMany({ where: { alunoId } });
  revalidatePath(`/alunos/${alunoId}/editar`);
  redirect(`/alunos/${alunoId}/editar`);
}
