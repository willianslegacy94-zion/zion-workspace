import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { escapeHtml, sendEmail, type SendResult } from "@/lib/email/send";
import type { SpaceRole } from "@telovis/protocol";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Endereço público do app, para montar links que saem por e-mail. */
function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

export interface InviteSent {
  link: string;
  email: SendResult;
}

/**
 * Cria o convite (ou renova o existente para o mesmo e-mail: token novo,
 * prazo novo, papel atualizado) e manda o e-mail. O token cru só existe aqui
 * e no link; o banco guarda o hash.
 */
export async function sendInvite(args: {
  space: { id: string; name: string };
  email: string;
  role: SpaceRole;
  inviter: { id: string; name: string };
}): Promise<InviteSent> {
  const token = randomBytes(32).toString("base64url");
  const data = {
    role: args.role,
    tokenHash: hashToken(token),
    invitedById: args.inviter.id,
    expiresAt: new Date(Date.now() + INVITE_TTL_MS),
  };
  await prisma.invite.upsert({
    where: { spaceId_email: { spaceId: args.space.id, email: args.email } },
    create: { ...data, spaceId: args.space.id, email: args.email },
    update: data,
  });

  const link = `${appUrl()}/convite/${token}`;
  const space = escapeHtml(args.space.name);
  const inviter = escapeHtml(args.inviter.name);
  const email = await sendEmail({
    to: args.email,
    subject: `${args.inviter.name} convidou você para ${args.space.name} no TeloVis Space`,
    text:
      `${args.inviter.name} convidou você para o escritório virtual "${args.space.name}" no TeloVis Space.\n\n` +
      `Aceite o convite: ${link}\n\nO link vale por 7 dias.`,
    html:
      `<p><strong>${inviter}</strong> convidou você para o escritório virtual <strong>${space}</strong> no TeloVis Space.</p>` +
      `<p><a href="${link}">Aceitar o convite</a></p>` +
      `<p style="color:#64748b">O link vale por 7 dias. Se não esperava este convite, ignore este e-mail.</p>`,
  });
  return { link, email };
}

/** Convite válido (não expirado) do token, com o space e quem convidou. */
export async function findInvite(token: string) {
  if (!token || token.length > 128) return null;
  const invite = await prisma.invite.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      email: true,
      role: true,
      expiresAt: true,
      space: { select: { id: true, slug: true, name: true, ownerId: true } },
      invitedBy: { select: { name: true } },
    },
  });
  if (!invite || invite.expiresAt.getTime() <= Date.now()) return null;
  return invite;
}
