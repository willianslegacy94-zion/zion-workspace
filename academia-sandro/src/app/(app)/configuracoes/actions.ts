"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function atualizarPerfil(formData: FormData) {
  "use server";

  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/login");
  }

  const nome = String(formData.get("nome") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const telefone = String(formData.get("telefone") ?? "").trim() || null;

  if (!nome || !email) {
    redirect("/configuracoes?erro=" + encodeURIComponent("Preencha nome e e-mail."));
  }

  try {
    await prisma.usuario.update({
      where: { id: userId },
      data: { nome, email, telefone },
    });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      redirect(
        "/configuracoes?erro=" +
          encodeURIComponent("Este e-mail já está em uso por outro usuário."),
      );
    }
    throw error;
  }

  revalidatePath("/configuracoes");
  redirect("/configuracoes?sucesso=1");
}
