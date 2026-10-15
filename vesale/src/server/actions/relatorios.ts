"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function exigirGestor() {
  const session = await auth();
  if (!session?.user || session.user.papel !== "GESTOR") {
    // RF-002/RNF-002 — relatório de vendas expõe volume/receita, exclusivo do gestor.
    throw new Error("Acesso restrito ao gestor.");
  }
  return session;
}

export type PeriodoRelatorio = { de: string; ate: string };

export type ResumoVendas = {
  totalVendido: number;
  quantidadeVendas: number;
  ticketMedio: number;
  produtosMaisVendidos: Array<{ produtoId: string; nome: string; quantidade: number }>;
  porFormaPagamento: Array<{ formaPagamentoId: string; nome: string; total: number }>;
};

/** Consolida vendas finalizadas no período — total, ticket médio, ranking e forma de pagamento. */
export async function buscarResumoVendas({ de, ate }: PeriodoRelatorio): Promise<ResumoVendas> {
  await exigirGestor();

  const inicio = new Date(`${de}T00:00:00`);
  const fim = new Date(`${ate}T23:59:59.999`);

  const vendas = await prisma.venda.findMany({
    where: { status: "FINALIZADA", finalizadaEm: { gte: inicio, lte: fim } },
    include: {
      formaPagamento: { select: { id: true, nome: true } },
      itens: { include: { produto: { select: { id: true, nome: true } } } },
    },
  });

  const totalVendido = vendas.reduce((acc, venda) => acc + Number(venda.valorTotal), 0);
  const quantidadeVendas = vendas.length;
  const ticketMedio = quantidadeVendas > 0 ? totalVendido / quantidadeVendas : 0;

  const porProduto = new Map<string, { nome: string; quantidade: number }>();
  const porForma = new Map<string, { nome: string; total: number }>();

  for (const venda of vendas) {
    for (const item of venda.itens) {
      const atual = porProduto.get(item.produtoId) ?? { nome: item.produto.nome, quantidade: 0 };
      atual.quantidade += item.quantidade;
      porProduto.set(item.produtoId, atual);
    }
    if (venda.formaPagamento) {
      const atual = porForma.get(venda.formaPagamento.id) ?? { nome: venda.formaPagamento.nome, total: 0 };
      atual.total += Number(venda.valorTotal);
      porForma.set(venda.formaPagamento.id, atual);
    }
  }

  const produtosMaisVendidos = [...porProduto.entries()]
    .map(([produtoId, dado]) => ({ produtoId, ...dado }))
    .sort((a, b) => b.quantidade - a.quantidade)
    .slice(0, 10);

  const porFormaPagamento = [...porForma.entries()]
    .map(([formaPagamentoId, dado]) => ({ formaPagamentoId, ...dado }))
    .sort((a, b) => b.total - a.total);

  return { totalVendido, quantidadeVendas, ticketMedio, produtosMaisVendidos, porFormaPagamento };
}
