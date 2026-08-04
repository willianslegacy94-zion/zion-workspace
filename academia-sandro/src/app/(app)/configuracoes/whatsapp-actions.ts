"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import * as whatsappGateway from "@/lib/whatsapp-gateway";

export async function buscarStatusConexaoAction() {
  return whatsappGateway.buscarStatusConexao();
}

export async function buscarQrCodeAction() {
  return whatsappGateway.buscarQrCode();
}

export async function desconectarWhatsappAction() {
  return whatsappGateway.desconectarWhatsapp();
}

export async function buscarNumeroConectadoAction() {
  return whatsappGateway.buscarNumeroConectado();
}

// Copia o número pareado no WhatsApp pro campo Telefone do Perfil do admin
// logado — os dois campos servem propósitos diferentes (um envia as
// mensagens automáticas, o outro é só pra onde os avisos administrativos
// chegam), mas na prática costumam ser o mesmo número.
export async function sincronizarTelefonePerfilAction(numero: string) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    throw new Error("Sessão inválida.");
  }

  await prisma.usuario.update({
    where: { id: userId },
    data: { telefone: numero },
  });

  revalidatePath("/configuracoes");
}
