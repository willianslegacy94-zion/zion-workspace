"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function marcarAlertasComoLidos() {
  const session = await auth();
  const usuarioId = session?.user?.id;
  if (!usuarioId) {
    throw new Error("Sessão inválida.");
  }

  await prisma.usuario.update({
    where: { id: usuarioId },
    data: { alertasLidosEm: new Date() },
  });

  revalidatePath("/", "layout");
}
