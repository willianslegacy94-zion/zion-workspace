"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function exigirGestor() {
  const session = await auth();
  if (!session?.user || session.user.papel !== "GESTOR") {
    throw new Error("Acesso restrito ao gestor.");
  }
  return session;
}

const DIAS_ALERTA_VALIDADE = 30;

export type ResumoDashboard = {
  vendasHojeTotal: number;
  vendasHojeQuantidade: number;
  caixaAberto: boolean;
  caixaAbertaEm: string | null;
  produtosEstoqueBaixo: Array<{ id: string; nome: string; quantidadeEstoque: number; estoqueMinimo: number }>;
  produtosVencendo: Array<{ id: string; nome: string; validade: string; diasRestantes: number }>;
};

/** Painel do gestor — visão geral do dia (RF-007 + KPIs de venda e caixa). */
export async function buscarResumoDashboard(): Promise<ResumoDashboard> {
  await exigirGestor();

  const inicioHoje = new Date();
  inicioHoje.setHours(0, 0, 0, 0);
  const fimHoje = new Date();
  fimHoje.setHours(23, 59, 59, 999);

  const [vendasHoje, sessaoAberta, produtosEstoque, lotesVencendo] = await Promise.all([
    prisma.venda.aggregate({
      where: { status: "FINALIZADA", finalizadaEm: { gte: inicioHoje, lte: fimHoje } },
      _sum: { valorTotal: true },
      _count: true,
    }),
    prisma.sessaoCaixa.findFirst({ where: { status: "ABERTA" }, select: { abertaEm: true } }),
    prisma.produto.findMany({
      where: { status: "ATIVO" },
      select: { id: true, nome: true, quantidadeEstoque: true, estoqueMinimo: true },
    }),
    prisma.loteProduto.findMany({
      where: {
        quantidade: { gt: 0 },
        validade: { lte: new Date(Date.now() + DIAS_ALERTA_VALIDADE * 86400000) },
      },
      include: { produto: { select: { nome: true } } },
      orderBy: { validade: "asc" },
      take: 8,
    }),
  ]);

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  return {
    vendasHojeTotal: vendasHoje._sum.valorTotal ? Number(vendasHoje._sum.valorTotal) : 0,
    vendasHojeQuantidade: vendasHoje._count,
    caixaAberto: Boolean(sessaoAberta),
    caixaAbertaEm: sessaoAberta ? sessaoAberta.abertaEm.toISOString() : null,
    produtosEstoqueBaixo: produtosEstoque
      .filter((p) => p.quantidadeEstoque <= p.estoqueMinimo)
      .slice(0, 8),
    produtosVencendo: lotesVencendo.map((lote) => ({
      id: lote.id,
      nome: lote.produto.nome,
      validade: lote.validade.toISOString().slice(0, 10),
      diasRestantes: Math.round((lote.validade.getTime() - hoje.getTime()) / 86400000),
    })),
  };
}
