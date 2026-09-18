"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function exigirGestor() {
  const session = await auth();
  if (!session?.user || session.user.papel !== "GESTOR") {
    // RF-002/RNF-002 — painel de precificação/CMV é exclusivo do gestor.
    throw new Error("Acesso restrito ao gestor.");
  }
  return session;
}

export type ProdutoPrecificacao = {
  id: string;
  nome: string;
  categoriaNome: string;
  custoTravado: number | null;
  precoVenda: number | null;
  // RN-010 — null quando não há custo travado ainda ("custo pendente"),
  // nunca uma margem estimada a partir de custo inexistente.
  margemPercentual: number | null;
  margemNegativa: boolean;
};

/** RF-019/RF-021 — custo travado e preço lado a lado, com margem e alerta de margem negativa/zerada. */
export async function listarPrecificacao(): Promise<ProdutoPrecificacao[]> {
  await exigirGestor();

  const produtos = await prisma.produto.findMany({
    where: { status: "ATIVO" },
    include: { categoria: { select: { nome: true } } },
    orderBy: { nome: "asc" },
  });

  return produtos.map((produto) => {
    const custo = produto.custoTravado ? Number(produto.custoTravado) : null;
    const preco = produto.precoVenda ? Number(produto.precoVenda) : null;
    const margemPercentual = custo && custo > 0 && preco !== null ? ((preco - custo) / custo) * 100 : null;

    return {
      id: produto.id,
      nome: produto.nome,
      categoriaNome: produto.categoria.nome,
      custoTravado: custo,
      precoVenda: preco,
      margemPercentual,
      margemNegativa: custo !== null && preco !== null && preco <= custo,
    };
  });
}

const precoSchema = z.object({
  precoVenda: z.coerce.number().min(0.01, "Informe um preço maior que zero."),
});

export type PrecoFormState = { ok: boolean; message?: string };

/** RF-020 — edita só o preço de venda; nunca toca em custoTravado (RN-009). */
export async function atualizarPrecoVenda(
  produtoId: string,
  _prevState: PrecoFormState,
  formData: FormData,
): Promise<PrecoFormState> {
  try {
    await exigirGestor();
    const parsed = precoSchema.safeParse({ precoVenda: formData.get("precoVenda") });
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "Preço inválido." };
    }

    await prisma.produto.update({
      where: { id: produtoId },
      data: { precoVenda: parsed.data.precoVenda },
    });

    revalidatePath("/rentabilidade");
    revalidatePath("/estoque");
    revalidatePath("/pdv");
    return { ok: true };
  } catch {
    return { ok: false, message: "Não foi possível atualizar o preço." };
  }
}

export type PeriodoCmv = { de: string; ate: string };

export type ResumoCmv = {
  cmvTotal: number;
  receitaTotal: number;
  lucroBruto: number;
  margemBrutaPercentual: number;
  quantidadeItens: number;
  // Itens vendidos sem custo travado no momento da venda — não entram no CMV
  // (RN-012: nunca custo estimado), mas o gestor precisa saber que existem.
  itensSemCustoTravado: number;
};

/** RF-022 — CMV do período: soma do custo travado de cada unidade vendida (RN-012, nunca custo estimado). */
export async function calcularCmvPeriodo({ de, ate }: PeriodoCmv): Promise<ResumoCmv> {
  await exigirGestor();

  const inicio = new Date(`${de}T00:00:00`);
  const fim = new Date(`${ate}T23:59:59.999`);

  const vendas = await prisma.venda.findMany({
    where: { status: "FINALIZADA", finalizadaEm: { gte: inicio, lte: fim } },
    include: { itens: true },
  });

  let cmvTotal = 0;
  let receitaTotal = 0;
  let quantidadeItens = 0;
  let itensSemCustoTravado = 0;

  for (const venda of vendas) {
    receitaTotal += Number(venda.valorTotal);
    for (const item of venda.itens) {
      quantidadeItens += item.quantidade;
      if (item.custoUnitarioNoMomento === null) {
        itensSemCustoTravado += item.quantidade;
        continue;
      }
      cmvTotal += Number(item.custoUnitarioNoMomento) * item.quantidade;
    }
  }

  const lucroBruto = receitaTotal - cmvTotal;

  return {
    cmvTotal,
    receitaTotal,
    lucroBruto,
    margemBrutaPercentual: receitaTotal > 0 ? (lucroBruto / receitaTotal) * 100 : 0,
    quantidadeItens,
    itensSemCustoTravado,
  };
}
