import type { Prisma } from "@/generated/prisma/client";

/**
 * RN-015 — consome lotes por FEFO (validade mais próxima primeiro) para a
 * quantidade vendida. Não mexe em Produto.quantidadeEstoque — isso continua
 * responsabilidade de quem chama (finalizarVenda), que decrementa o agregado
 * independentemente de o produto ter lote ou não (produto sem lote nunca
 * passa por aqui com efeito nenhum). Retorna o id do primeiro lote de onde
 * saiu a baixa (ou null se o produto não tem lote com saldo), usado só para
 * rastreabilidade em ItemVenda.loteId.
 */
export async function baixarPorFefo(
  tx: Prisma.TransactionClient,
  produtoId: string,
  quantidade: number,
): Promise<string | null> {
  const lotes = await tx.loteProduto.findMany({
    where: { produtoId, quantidade: { gt: 0 } },
    orderBy: { validade: "asc" },
  });

  let restante = quantidade;
  let primeiroLoteUsado: string | null = null;

  for (const lote of lotes) {
    if (restante <= 0) break;
    const consumido = Math.min(lote.quantidade, restante);
    await tx.loteProduto.update({
      where: { id: lote.id },
      data: { quantidade: { decrement: consumido } },
    });
    if (!primeiroLoteUsado) primeiroLoteUsado = lote.id;
    restante -= consumido;
  }

  return primeiroLoteUsado;
}
