"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function rejeitarPreCadastro(id: string) {
  await prisma.preCadastro.update({
    where: { id },
    data: { status: "Rejeitado" },
  });

  revalidatePath("/pre-cadastros");
}
