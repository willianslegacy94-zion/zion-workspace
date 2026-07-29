"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { MODALIDADES } from "@/lib/modalidades";

export async function salvarPrecosModalidade(formData: FormData) {
  await Promise.all(
    MODALIDADES.map((modalidade) => {
      const valorRaw = String(formData.get(`preco_${modalidade}`) ?? "0")
        .trim()
        .replace(",", ".");
      const valor = Number(valorRaw) || 0;

      return prisma.modalidadePreco.upsert({
        where: { modalidade },
        update: { valor },
        create: { modalidade, valor },
      });
    }),
  );

  revalidatePath("/agenda");
  revalidatePath("/aluno/matricula");
}
