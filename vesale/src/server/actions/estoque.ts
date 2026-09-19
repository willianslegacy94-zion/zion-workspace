"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

function ehCodigoBarrasDuplicado(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

async function exigirGestor() {
  const session = await auth();
  if (!session?.user || session.user.papel !== "GESTOR") {
    // RF-002/RNF-002 — cadastro de produto e custo são exclusivos do gestor;
    // a verificação aqui é a que vale de fato (defesa em profundidade).
    throw new Error("Acesso restrito ao gestor.");
  }
  return session;
}

async function exigirAutenticado() {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Não autenticado.");
  }
  return session;
}

export type CategoriaOption = { id: string; nome: string };

export async function listarCategorias(): Promise<CategoriaOption[]> {
  return prisma.categoriaProduto.findMany({ select: { id: true, nome: true }, orderBy: { nome: "asc" } });
}

export type ProdutoEstoque = {
  id: string;
  nome: string;
  codigoBarras: string | null;
  categoriaId: string;
  categoriaNome: string;
  unidade: string;
  // Somente leitura aqui — nunca editável fora da conciliação de nota fiscal (RN-009).
  custoTravado: number | null;
  precoVenda: number | null;
  quantidadeEstoque: number;
  estoqueMinimo: number;
  medicamentoControlado: boolean;
  status: "ATIVO" | "INATIVO";
  validadeMaisProxima: string | null;
};

/**
 * RF-004/RF-007 — catálogo completo com sinalização de estoque baixo.
 * Operador de caixa também acessa esta tela, mas só enxerga o preço de
 * venda — o custo travado nunca sai do servidor para esse papel (defesa em
 * profundidade, não é só ocultado na UI).
 */
export async function listarProdutosEstoque(): Promise<ProdutoEstoque[]> {
  const session = await exigirAutenticado();
  const podeVerCusto = session.user.papel === "GESTOR";

  const produtos = await prisma.produto.findMany({
    include: {
      categoria: { select: { nome: true } },
      lotes: { where: { quantidade: { gt: 0 } }, orderBy: { validade: "asc" }, take: 1 },
    },
    orderBy: { nome: "asc" },
  });

  return produtos.map((produto) => ({
    id: produto.id,
    nome: produto.nome,
    codigoBarras: produto.codigoBarras,
    categoriaId: produto.categoriaId,
    categoriaNome: produto.categoria.nome,
    unidade: produto.unidade,
    custoTravado: podeVerCusto && produto.custoTravado ? Number(produto.custoTravado) : null,
    precoVenda: produto.precoVenda ? Number(produto.precoVenda) : null,
    quantidadeEstoque: produto.quantidadeEstoque,
    estoqueMinimo: produto.estoqueMinimo,
    medicamentoControlado: produto.medicamentoControlado,
    status: produto.status,
    validadeMaisProxima: produto.lotes[0]?.validade.toISOString().slice(0, 10) ?? null,
  }));
}

const produtoSchema = {
  nome: z.string().trim().min(1, "Informe o nome do produto."),
  categoriaId: z.string().uuid("Selecione uma categoria."),
  codigoBarras: z.string().trim().optional(),
  unidade: z.string().trim().min(1).default("un"),
  estoqueMinimo: z.coerce.number().int().min(0).default(0),
  precoVenda: z.coerce.number().min(0).optional(),
  medicamentoControlado: z.coerce.boolean().default(false),
};

export type ProdutoFormState = { ok: boolean; message?: string };

function parseProdutoFormData(formData: FormData) {
  return z.object(produtoSchema).safeParse({
    nome: formData.get("nome"),
    categoriaId: formData.get("categoriaId"),
    codigoBarras: formData.get("codigoBarras") || undefined,
    unidade: formData.get("unidade") || "un",
    estoqueMinimo: formData.get("estoqueMinimo") || 0,
    precoVenda: formData.get("precoVenda") || undefined,
    medicamentoControlado: formData.get("medicamentoControlado") === "on",
  });
}

/** RF-004 — cadastra produto. Nunca aceita custoTravado (RN-009). */
export async function criarProduto(
  _prevState: ProdutoFormState,
  formData: FormData,
): Promise<ProdutoFormState> {
  try {
    await exigirGestor();
    const parsed = parseProdutoFormData(formData);
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
    }

    await prisma.produto.create({
      data: {
        nome: parsed.data.nome,
        categoriaId: parsed.data.categoriaId,
        codigoBarras: parsed.data.codigoBarras || null,
        unidade: parsed.data.unidade,
        estoqueMinimo: parsed.data.estoqueMinimo,
        precoVenda: parsed.data.precoVenda ?? null,
        medicamentoControlado: parsed.data.medicamentoControlado,
      },
    });

    revalidatePath("/estoque");
    return { ok: true };
  } catch (error) {
    if (ehCodigoBarrasDuplicado(error)) {
      return { ok: false, message: "Já existe um produto com esse código de barras." };
    }
    return { ok: false, message: "Não foi possível cadastrar o produto." };
  }
}

/** RF-004 — edita produto (nunca custoTravado, RN-009). Pode inativar/reativar. */
export async function atualizarProduto(
  produtoId: string,
  _prevState: ProdutoFormState,
  formData: FormData,
): Promise<ProdutoFormState> {
  try {
    await exigirGestor();
    const parsed = parseProdutoFormData(formData);
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
    }
    const status = formData.get("status") === "INATIVO" ? "INATIVO" : "ATIVO";

    await prisma.produto.update({
      where: { id: produtoId },
      data: {
        nome: parsed.data.nome,
        categoriaId: parsed.data.categoriaId,
        codigoBarras: parsed.data.codigoBarras || null,
        unidade: parsed.data.unidade,
        estoqueMinimo: parsed.data.estoqueMinimo,
        precoVenda: parsed.data.precoVenda ?? null,
        medicamentoControlado: parsed.data.medicamentoControlado,
        status,
      },
    });

    revalidatePath("/estoque");
    return { ok: true };
  } catch (error) {
    if (ehCodigoBarrasDuplicado(error)) {
      return { ok: false, message: "Já existe um produto com esse código de barras." };
    }
    return { ok: false, message: "Não foi possível atualizar o produto." };
  }
}
