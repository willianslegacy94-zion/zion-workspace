"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { parseRole } from "@/lib/space/access";
import { checkSlug, getAdminSpace, slugify } from "@/lib/space/admin";
import { DEFAULT_MAP } from "@/lib/space/spaces";
import { notifyRealtime } from "@/lib/realtime/notify";
import { sendInvite, type InviteSent } from "@/lib/space/invites";
import { freeDesk } from "@telovis/protocol";

export type FormState =
  | {
      error?: string;
      ok?: string;
      values?: Record<string, string>;
      /** Link do convite, para copiar quando o e-mail não saiu. */
      inviteLink?: string;
    }
  | undefined;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function field(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

async function currentUserOrLogin() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard");
  return user;
}

/**
 * Usuário logado + space que ele administra; senão volta ao dashboard.
 * `slug` e `memberId` chegam como campos do formulário, ou seja, controlados
 * pelo cliente: a autorização é refeita aqui em toda action.
 */
async function requireAdmin(form: FormData) {
  const slug = field(form, "slug");
  const user = await currentUserOrLogin();
  const space = await getAdminSpace(slug, user.id);
  if (!space) redirect("/dashboard");
  return { user, space };
}

export async function createSpace(_: FormState, form: FormData): Promise<FormState> {
  const user = await currentUserOrLogin();
  const name = field(form, "name").slice(0, 48);
  const slug = slugify(field(form, "slug") || name);
  const values = { name, slug };

  if (name.length < 2) return { values, error: "Dê um nome ao escritório (mínimo 2 letras)." };
  const slugError = checkSlug(slug);
  if (slugError) return { values, error: slugError };

  try {
    await prisma.space.create({ data: { name, slug, ownerId: user.id, ...DEFAULT_MAP } });
  } catch (err) {
    if (isUniqueViolation(err)) return { values, error: `O endereço "${slug}" já está em uso.` };
    throw err;
  }
  redirect(`/dashboard/${slug}`);
}

function inviteResult(email: string, sent: InviteSent): FormState {
  if (sent.email.delivered) return { ok: `Convite enviado para ${email}.` };
  return {
    ok: `Convite criado para ${email}, mas o e-mail não saiu (${sent.email.reason}). Envie o link:`,
    inviteLink: sent.link,
  };
}

export async function addMember(_: FormState, form: FormData): Promise<FormState> {
  const { user, space } = await requireAdmin(form);
  const email = field(form, "email").toLowerCase();
  const role = parseRole(field(form, "role")) ?? "MEMBER";
  const values = { email, role };

  const invitee = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true },
  });
  if (!invitee) {
    // Sem conta: convite por e-mail; ela entra ao criar a conta pelo link.
    if (!EMAIL_RE.test(email)) return { values, error: "E-mail inválido." };
    const sent = await sendInvite({ space, email, role, inviter: user });
    revalidatePath(`/dashboard/${space.slug}`);
    return inviteResult(email, sent);
  }
  if (invitee.id === space.ownerId) return { values, error: `${invitee.name} é o dono deste escritório.` };

  try {
    await prisma.spaceMember.create({ data: { userId: invitee.id, spaceId: space.id, role } });
  } catch (err) {
    if (isUniqueViolation(err)) return { values, error: `${invitee.name} já é membro.` };
    throw err;
  }
  revalidatePath(`/dashboard/${space.slug}`);
  return { ok: `${invitee.name} adicionado como ${role}.` };
}

export async function updateMemberRole(form: FormData) {
  const { space } = await requireAdmin(form);
  const role = parseRole(field(form, "role"));
  if (!role) return;
  // spaceId no where: um admin de um space não mexe em membros de outro.
  const member = await prisma.spaceMember.findFirst({
    where: { id: field(form, "memberId"), spaceId: space.id },
    select: { id: true, userId: true },
  });
  if (!member) return;
  await prisma.spaceMember.update({ where: { id: member.id }, data: { role } });
  await notifyRealtime({ type: "member.role", userId: member.userId, space: space.slug, role });
  revalidatePath(`/dashboard/${space.slug}`);
}

export async function removeMember(form: FormData) {
  const { space } = await requireAdmin(form);
  const member = await prisma.spaceMember.findFirst({
    where: { id: field(form, "memberId"), spaceId: space.id },
    select: { id: true, userId: true },
  });
  if (!member) return;
  const desk = await prisma.desk.findUnique({
    where: { spaceId_userId: { spaceId: space.id, userId: member.userId } },
    select: { key: true },
  });
  await prisma.$transaction([
    prisma.spaceMember.delete({ where: { id: member.id } }),
    // A mesa de quem sai volta a ficar livre.
    prisma.desk.deleteMany({ where: { spaceId: space.id, userId: member.userId } }),
  ]);
  // Quem está dentro do escritório sai na hora, não só na próxima reconexão.
  await notifyRealtime({ type: "member.removed", userId: member.userId, space: space.slug });
  if (desk) await notifyRealtime({ type: "desk.updated", space: space.slug, desk: freeDesk(desk.key) });
  revalidatePath(`/dashboard/${space.slug}`);
}

/** Admin libera a mesa de alguém (ex.: pessoa saiu da equipe ou trocou de time). */
export async function adminReleaseDesk(form: FormData) {
  const { space } = await requireAdmin(form);
  const key = field(form, "deskKey");
  const { count } = await prisma.desk.deleteMany({ where: { spaceId: space.id, key } });
  if (count > 0) await notifyRealtime({ type: "desk.updated", space: space.slug, desk: freeDesk(key) });
  revalidatePath(`/dashboard/${space.slug}`);
}

/** Gera um link novo (o antigo deixa de valer) e manda o e-mail de novo. */
export async function resendInvite(_: FormState, form: FormData): Promise<FormState> {
  const { user, space } = await requireAdmin(form);
  const invite = await prisma.invite.findFirst({
    where: { id: field(form, "inviteId"), spaceId: space.id },
    select: { email: true, role: true },
  });
  if (!invite) return { error: "Convite não encontrado." };
  const sent = await sendInvite({
    space,
    email: invite.email,
    role: parseRole(invite.role) ?? "MEMBER",
    inviter: user,
  });
  revalidatePath(`/dashboard/${space.slug}`);
  return inviteResult(invite.email, sent);
}

export async function cancelInvite(form: FormData) {
  const { space } = await requireAdmin(form);
  await prisma.invite.deleteMany({ where: { id: field(form, "inviteId"), spaceId: space.id } });
  revalidatePath(`/dashboard/${space.slug}`);
}
