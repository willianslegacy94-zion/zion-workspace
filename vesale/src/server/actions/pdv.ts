"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { baixarPorFefo } from "@/lib/estoque/baixa";

export type ProdutoBusca = {
  id: string;
  nome: string;
  codigoBarras: string | null;
  precoVenda: number | null;
  quantidadeEstoque: number;
  medicamentoControlado: boolean;
};

/**
 * Busca produto por código de barras (match exato, prioridade — leitor de
 * código de barras) ou por nome (busca parcial, RF-008/RF-009). Nunca
 * retorna custo travado nem margem — visão de operador de caixa não pode
 * carregar dado financeiro (RNF-002), mesmo sendo chamada pelo gestor.
 */
export async function buscarProdutos(query: string): Promise<ProdutoBusca[]> {
  const termo = query.trim();
  if (!termo) return [];

  const camposBusca = {
    id: true,
    nome: true,
    codigoBarras: true,
    precoVenda: true,
    quantidadeEstoque: true,
    medicamentoControlado: true,
  } as const;

  const porCodigoBarras = await prisma.produto.findFirst({
    where: { codigoBarras: termo, status: "ATIVO" },
    select: camposBusca,
  });

  if (porCodigoBarras) {
    return [
      {
        ...porCodigoBarras,
        precoVenda: porCodigoBarras.precoVenda ? Number(porCodigoBarras.precoVenda) : null,
      },
    ];
  }

  const porNome = await prisma.produto.findMany({
    where: { status: "ATIVO", nome: { contains: termo, mode: "insensitive" } },
    select: camposBusca,
    orderBy: { nome: "asc" },
    take: 8,
  });

  return porNome.map((produto) => ({
    ...produto,
    precoVenda: produto.precoVenda ? Number(produto.precoVenda) : null,
  }));
}

export type FormaPagamentoOption = { id: string; nome: string };

export async function listarFormasPagamento(): Promise<FormaPagamentoOption[]> {
  return prisma.formaPagamento.findMany({
    select: { id: true, nome: true },
    orderBy: { nome: "asc" },
  });
}

export type SessaoCaixaAtual = {
  id: string;
  valorAbertura: number;
  abertaEm: Date;
  operadorNome: string;
} | null;

/** Sessão de caixa aberta no momento (RF-013) — no máximo uma por vez. */
export async function buscarSessaoCaixaAberta(): Promise<SessaoCaixaAtual> {
  const sessao = await prisma.sessaoCaixa.findFirst({
    where: { status: "ABERTA" },
    select: { id: true, valorAbertura: true, abertaEm: true, operador: { select: { nome: true } } },
  });
  if (!sessao) return null;
  return {
    id: sessao.id,
    valorAbertura: Number(sessao.valorAbertura),
    abertaEm: sessao.abertaEm,
    operadorNome: sessao.operador.nome,
  };
}

export type AbrirCaixaState = { ok: boolean; message?: string };

const abrirCaixaSchema = z.object({
  valorAbertura: z.coerce.number().min(0, "Valor de abertura não pode ser negativo."),
});

export async function abrirCaixa(
  _prevState: AbrirCaixaState,
  formData: FormData,
): Promise<AbrirCaixaState> {
  try {
    const session = await auth();
    if (!session?.user) return { ok: false, message: "Sessão expirada. Faça login novamente." };

    const parsed = abrirCaixaSchema.safeParse({ valorAbertura: formData.get("valorAbertura") });
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "Valor inválido." };
    }

    const jaAberta = await prisma.sessaoCaixa.findFirst({ where: { status: "ABERTA" } });
    if (jaAberta) return { ok: false, message: "Já existe um caixa aberto." };

    await prisma.sessaoCaixa.create({
      data: {
        operadorId: session.user.id,
        valorAbertura: parsed.data.valorAbertura,
        status: "ABERTA",
      },
    });

    revalidatePath("/pdv");
    return { ok: true };
  } catch {
    return { ok: false, message: "Não foi possível abrir o caixa. Tente novamente." };
  }
}

const itemVendaSchema = z.object({
  produtoId: z.string().uuid(),
  quantidade: z.number().int().positive(),
  // RN-013 — confirmado pelo operador no client quando o produto é
  // medicamentoControlado; itens de produto não controlado ignoram o campo.
  receitaConfirmada: z.boolean().default(false),
});

const finalizarVendaSchema = z.object({
  sessaoCaixaId: z.string().uuid(),
  formaPagamentoId: z.string().uuid(),
  itens: z.array(itemVendaSchema).min(1, "Adicione ao menos um item à venda."),
  // RN-016 — abatimento sobre o subtotal; validado contra o subtotal real
  // dentro da transação, nunca confiando só no valor calculado no client.
  descontoValor: z.number().min(0).default(0),
});

export type FinalizarVendaInput = z.infer<typeof finalizarVendaSchema>;

export type ReciboItem = { nome: string; quantidade: number; precoUnitario: number };
export type Recibo = {
  vendaId: string;
  data: string;
  itens: ReciboItem[];
  subtotal: number;
  descontoValor: number;
  valorTotal: number;
};

export type FinalizarVendaResult = { ok: true; recibo: Recibo } | { ok: false; message: string };

/**
 * Finaliza a venda (RF-011). O carrinho vive só no client até aqui — nenhuma
 * linha é gravada enquanto a venda está "aberta" (RN-005: uma venda
 * finalizada é imutável, então só passamos a existir no banco no momento em
 * que ela já nasce imutável). Cancelar antes de finalizar (RF-012) é
 * simplesmente limpar o carrinho no client — nada grava, nada precisa
 * reverter.
 *
 * Retorna um resultado tipado em vez de lançar exceção: erro de negócio
 * (estoque insuficiente, preço não definido) precisa chegar legível na UI,
 * e o Next sanitiza mensagem de exceção de server action em produção.
 */
export async function finalizarVenda(input: FinalizarVendaInput): Promise<FinalizarVendaResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, message: "Sessão expirada. Faça login novamente." };

  const parsed = finalizarVendaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Venda inválida." };
  }
  const { sessaoCaixaId, formaPagamentoId, itens, descontoValor } = parsed.data;

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      const sessaoCaixa = await tx.sessaoCaixa.findUnique({ where: { id: sessaoCaixaId } });
      if (!sessaoCaixa || sessaoCaixa.status !== "ABERTA") {
        throw new Error("Caixa não está aberto.");
      }

      let subtotal = 0;
      const itensParaCriar = [];
      const itensRecibo: ReciboItem[] = [];

      for (const item of itens) {
        const produto = await tx.produto.findUnique({ where: { id: item.produtoId } });
        if (!produto || produto.status !== "ATIVO") {
          throw new Error("Produto não encontrado ou inativo.");
        }
        if (produto.quantidadeEstoque < item.quantidade) {
          // RN-004 — produto não pode ser vendido com estoque zero/negativo.
          throw new Error(`Estoque insuficiente para "${produto.nome}".`);
        }
        if (produto.precoVenda === null) {
          throw new Error(`"${produto.nome}" ainda não tem preço de venda definido.`);
        }
        if (produto.medicamentoControlado && !item.receitaConfirmada) {
          // RN-013 — venda bloqueia sem confirmação de receita por item controlado.
          throw new Error(`Confirme a receita de "${produto.nome}" antes de finalizar.`);
        }

        const precoUnitario = Number(produto.precoVenda);
        subtotal += precoUnitario * item.quantidade;

        // RN-015 — baixa por FEFO quando o produto tem lote; o agregado
        // quantidadeEstoque decrementa igual de qualquer forma.
        const loteId = await baixarPorFefo(tx, produto.id, item.quantidade);

        itensParaCriar.push({
          produtoId: produto.id,
          quantidade: item.quantidade,
          precoUnitarioNoMomento: produto.precoVenda,
          custoUnitarioNoMomento: produto.custoTravado,
          loteId,
          receitaConfirmada: item.receitaConfirmada,
        });
        itensRecibo.push({ nome: produto.nome, quantidade: item.quantidade, precoUnitario });

        await tx.produto.update({
          where: { id: produto.id },
          data: { quantidadeEstoque: { decrement: item.quantidade } },
        });
      }

      if (descontoValor > subtotal) {
        // RN-016 — desconto nunca pode superar o subtotal da venda.
        throw new Error("Desconto não pode ser maior que o subtotal da venda.");
      }
      const valorTotal = subtotal - descontoValor;

      const venda = await tx.venda.create({
        data: {
          operadorId: session.user.id,
          sessaoCaixaId,
          formaPagamentoId,
          descontoValor,
          valorTotal,
          status: "FINALIZADA",
          finalizadaEm: new Date(),
          itens: { create: itensParaCriar },
        },
      });

      const recibo: Recibo = {
        vendaId: venda.id,
        data: venda.finalizadaEm!.toISOString(),
        itens: itensRecibo,
        subtotal,
        descontoValor,
        valorTotal,
      };
      return recibo;
    });

    revalidatePath("/pdv");
    return { ok: true, recibo: resultado };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Não foi possível finalizar a venda.",
    };
  }
}

export type ResumoSessao = { totalVendido: number; quantidadeVendas: number };

/** Total já vendido na sessão aberta — referência no fechamento de caixa. */
export async function resumoSessaoAtual(sessaoCaixaId: string): Promise<ResumoSessao> {
  const agregado = await prisma.venda.aggregate({
    where: { sessaoCaixaId, status: "FINALIZADA" },
    _sum: { valorTotal: true },
    _count: true,
  });
  return {
    totalVendido: agregado._sum.valorTotal ? Number(agregado._sum.valorTotal) : 0,
    quantidadeVendas: agregado._count,
  };
}

const fecharCaixaSchema = z.object({
  sessaoCaixaId: z.string().uuid(),
  valorFechamento: z.coerce.number().min(0, "Valor de fechamento não pode ser negativo."),
});

export type FecharCaixaState = { ok: boolean; message?: string };

/** RF-013 — fecha a sessão de caixa do dia. */
export async function fecharCaixa(
  _prevState: FecharCaixaState,
  formData: FormData,
): Promise<FecharCaixaState> {
  try {
    const session = await auth();
    if (!session?.user) return { ok: false, message: "Sessão expirada. Faça login novamente." };

    const parsed = fecharCaixaSchema.safeParse({
      sessaoCaixaId: formData.get("sessaoCaixaId"),
      valorFechamento: formData.get("valorFechamento"),
    });
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "Valor inválido." };
    }

    const sessaoCaixa = await prisma.sessaoCaixa.findUnique({
      where: { id: parsed.data.sessaoCaixaId },
    });
    if (!sessaoCaixa || sessaoCaixa.status !== "ABERTA") {
      return { ok: false, message: "Esse caixa já não está aberto." };
    }

    await prisma.sessaoCaixa.update({
      where: { id: parsed.data.sessaoCaixaId },
      data: {
        status: "FECHADA",
        fechadaEm: new Date(),
        valorFechamento: parsed.data.valorFechamento,
      },
    });

    revalidatePath("/pdv");
    return { ok: true };
  } catch {
    return { ok: false, message: "Não foi possível fechar o caixa. Tente novamente." };
  }
}
