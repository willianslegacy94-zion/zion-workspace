import { prisma } from "@/lib/prisma";
import type { ItemNotaExtraido } from "./types";

// Vínculo automático de item de nota fiscal a produto do cadastro — RF-017.
// Só sugere vínculo em correspondência de alta confiança (código de barras
// exato ou nome normalizado idêntico); qualquer ambiguidade fica pendente
// de vínculo manual pelo gestor, nunca é "chutada" — um vínculo errado
// corromperia estoque e custo travado de um produto que não foi comprado.
const DIACRITICOS = new RegExp("[̀-ͯ]", "g");

function normalizarNome(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(DIACRITICOS, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

export async function sugerirVinculoProduto(item: ItemNotaExtraido): Promise<string | null> {
  if (item.codigoBarras) {
    const porCodigoBarras = await prisma.produto.findUnique({
      where: { codigoBarras: item.codigoBarras },
      select: { id: true },
    });
    if (porCodigoBarras) return porCodigoBarras.id;
  }

  const nomeAlvo = normalizarNome(item.descricaoFornecedor);
  const candidatos = await prisma.produto.findMany({
    where: { status: "ATIVO" },
    select: { id: true, nome: true },
  });
  const correspondencias = candidatos.filter((produto) => normalizarNome(produto.nome) === nomeAlvo);

  return correspondencias.length === 1 ? correspondencias[0].id : null;
}
