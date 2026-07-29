import { prisma } from "@/lib/prisma";
import { MODALIDADES } from "@/lib/modalidades";

export async function getPrecosModalidade(): Promise<Record<string, number>> {
  const precos = await prisma.modalidadePreco.findMany();
  const mapa = new Map(precos.map((p) => [p.modalidade, Number(p.valor)]));

  return Object.fromEntries(
    MODALIDADES.map((modalidade) => [modalidade, mapa.get(modalidade) ?? 0]),
  );
}
