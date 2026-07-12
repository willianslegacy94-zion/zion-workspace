import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export class RecuperacaoSenhaError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function solicitarRecuperacao(emailBruto: string, origin: string) {
  const email = emailBruto.trim().toLowerCase();

  if (!email) {
    throw new RecuperacaoSenhaError("Informe o e-mail.", 400);
  }

  const usuario = await prisma.usuario.findUnique({ where: { email } });

  if (!usuario) {
    throw new RecuperacaoSenhaError(
      "E-mail não encontrado. Contate o administrador.",
      404,
    );
  }

  const token = crypto.randomBytes(32).toString("hex");
  const tokenExpiracao = new Date(Date.now() + 60 * 60 * 1000);

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { tokenRecuperacao: token, tokenExpiracao },
  });

  return {
    token,
    link: `${origin}/resetar-senha?token=${token}`,
    aviso:
      "Sem SMTP configurado — envie este link manualmente para o usuário (ex: WhatsApp).",
  };
}

export async function resetarSenha(token: string, novaSenha: string) {
  if (!token || novaSenha.length < 6) {
    throw new RecuperacaoSenhaError(
      "Token inválido ou senha deve ter ao menos 6 caracteres.",
      400,
    );
  }

  const usuario = await prisma.usuario.findFirst({
    where: {
      tokenRecuperacao: token,
      tokenExpiracao: { gt: new Date() },
    },
  });

  if (!usuario) {
    throw new RecuperacaoSenhaError("Token inválido ou expirado.", 400);
  }

  const passwordHash = await bcrypt.hash(novaSenha, 12);

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: {
      passwordHash,
      senhaTemporaria: false,
      tokenRecuperacao: null,
      tokenExpiracao: null,
    },
  });
}
