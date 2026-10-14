"use server";

import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { parseRole } from "@/lib/space/access";
import { findInvite } from "@/lib/space/invites";

/**
 * Aceita o convite do token: exige estar logado com o MESMO e-mail do
 * convite (quem só tem o link não entra com outra conta). Vira SpaceMember e
 * o convite é apagado.
 */
export async function acceptInvite(form: FormData) {
  const token = String(form.get("token") ?? "");
  const back = `/convite/${encodeURIComponent(token)}`;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(back)}`);

  const invite = await findInvite(token);
  // Página do convite explica o que houve (expirado, outra conta…).
  if (!invite || invite.email !== user.email) redirect(back);

  if (invite.space.ownerId !== user.id) {
    try {
      await prisma.spaceMember.create({
        data: { userId: user.id, spaceId: invite.space.id, role: parseRole(invite.role) ?? "MEMBER" },
      });
    } catch (err) {
      // Já era membro (ex.: adicionado direto depois do convite): segue.
      if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) throw err;
    }
  }
  await prisma.invite.deleteMany({ where: { id: invite.id } });
  redirect(`/space/${invite.space.slug}`);
}
