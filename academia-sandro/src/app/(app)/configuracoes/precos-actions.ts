"use server";

import { prisma } from "@/lib/prisma";
import { MODALIDADES } from "@/lib/modalidades";
import { revalidatePath } from "next/cache";

function parseValor(raw: FormDataEntryValue | null) {
  return Number(String(raw ?? "0").trim().replace(",", ".")) || 0;
}

function revalidarTudo() {
  revalidatePath("/configuracoes");
  revalidatePath("/alunos");
  revalidatePath("/aluno/financeiro");
}

export async function salvarPrecosModalidade(formData: FormData) {
  await Promise.all(
    MODALIDADES.map((modalidade) => {
      const valor = parseValor(formData.get(`preco_${modalidade}`));

      return prisma.modalidadePreco.upsert({
        where: { modalidade },
        update: { valor },
        create: { modalidade, valor },
      });
    }),
  );

  revalidatePath("/configuracoes");
  revalidatePath("/agenda");
  revalidatePath("/aluno/matricula");
  revalidatePath("/aluno/financeiro");
}

export async function atualizarMensalidadeAluno(alunoId: string, formData: FormData) {
  const valorRaw = String(formData.get("mensalidadeValor") ?? "").trim().replace(",", ".");
  const mensalidadeValor = valorRaw ? Number(valorRaw) : null;

  await prisma.aluno.update({
    where: { id: alunoId },
    data: { mensalidadeValor },
  });

  revalidarTudo();
}

export async function criarPacote(formData: FormData) {
  const tipo = String(formData.get("tipo") ?? "").trim();
  const nome = String(formData.get("nome") ?? "").trim();

  if (!nome) {
    throw new Error("Dê um nome pro pacote.");
  }

  if (tipo === "COMBO_MODALIDADES") {
    const alunoId = String(formData.get("alunoId") ?? "").trim();
    const descontoPercentual = parseValor(formData.get("desconto"));

    // Sem aluno = cria só o modelo do combo (catálogo), pro próprio aluno
    // escolher depois no autocadastro/matrícula — ver getPacotesComboDisponiveis.
    await prisma.pacote.create({
      data: alunoId
        ? {
            nome,
            tipo: "COMBO_MODALIDADES",
            descontoPadrao: descontoPercentual,
            membros: { create: { alunoId, descontoPercentual, titular: true } },
          }
        : {
            nome,
            tipo: "COMBO_MODALIDADES",
            descontoPadrao: descontoPercentual,
          },
    });
  } else if (tipo === "FAMILIA") {
    const alunosSelecionados = Array.from(formData.entries())
      .filter(([chave, valor]) => chave.startsWith("incluir_") && valor === "on")
      .map(([chave]) => chave.replace("incluir_", ""));

    if (alunosSelecionados.length === 0) {
      throw new Error("Selecione pelo menos um aluno pra família.");
    }

    const titularEscolhido = String(formData.get("titular") ?? "").trim();
    const titularId = alunosSelecionados.includes(titularEscolhido)
      ? titularEscolhido
      : alunosSelecionados[0];

    await prisma.pacote.create({
      data: {
        nome,
        tipo: "FAMILIA",
        membros: {
          create: alunosSelecionados.map((alunoId) => ({
            alunoId,
            descontoPercentual: parseValor(formData.get(`desconto_${alunoId}`)),
            titular: alunoId === titularId,
          })),
        },
      },
    });
  } else {
    throw new Error("Escolha o tipo do pacote.");
  }

  revalidarTudo();
}

// Vincula um aluno a um pacote Combo criado como catálogo (sem membro ainda)
// — usado pelo admin quando o aluno não escolheu o combo sozinho no
// autocadastro e precisa ser vinculado manualmente depois.
export async function atribuirAlunoPacote(pacoteId: string, formData: FormData) {
  const alunoId = String(formData.get("alunoId") ?? "").trim();
  if (!alunoId) {
    throw new Error("Selecione o aluno.");
  }

  const pacote = await prisma.pacote.findUnique({ where: { id: pacoteId } });
  if (!pacote) {
    throw new Error("Pacote não encontrado.");
  }

  const descontoPercentual = pacote.descontoPadrao ? Number(pacote.descontoPadrao) : 0;

  await prisma.pacoteMembro.upsert({
    where: { alunoId },
    update: { pacoteId, descontoPercentual, titular: true },
    create: { alunoId, pacoteId, descontoPercentual, titular: true },
  });

  revalidarTudo();
}

export async function atualizarDescontoMembro(membroId: string, formData: FormData) {
  const descontoPercentual = parseValor(formData.get("descontoPercentual"));

  await prisma.pacoteMembro.update({
    where: { id: membroId },
    data: { descontoPercentual },
  });

  revalidarTudo();
}

export async function definirTitular(pacoteId: string, alunoId: string) {
  await prisma.$transaction([
    prisma.pacoteMembro.updateMany({
      where: { pacoteId },
      data: { titular: false },
    }),
    prisma.pacoteMembro.updateMany({
      where: { pacoteId, alunoId },
      data: { titular: true },
    }),
  ]);

  revalidarTudo();
}

export async function removerMembroPacote(membroId: string) {
  const membro = await prisma.pacoteMembro.findUnique({ where: { id: membroId } });
  if (!membro) return;

  await prisma.pacoteMembro.delete({ where: { id: membroId } });

  const restantes = await prisma.pacoteMembro.count({
    where: { pacoteId: membro.pacoteId },
  });
  if (restantes === 0) {
    await prisma.pacote.delete({ where: { id: membro.pacoteId } });
  }

  revalidarTudo();
}

export async function excluirPacote(pacoteId: string) {
  await prisma.pacote.delete({ where: { id: pacoteId } });
  revalidarTudo();
}
