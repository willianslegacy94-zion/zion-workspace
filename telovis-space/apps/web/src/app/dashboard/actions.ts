"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { parseRole } from "@/lib/space/access";
import { checkSlug, getAdminSpace, slugify } from "@/lib/space/admin";
import { DEFAULT_MAP } from "@/lib/space/spaces";

export type FormState = { error?: string; ok?: string; values?: Record<string, string> } | undefined;

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

export async function addMember(_: FormState, form: FormData): Promise<FormState> {
  const { space } = await requireAdmin(form);
  const email = field(form, "email").toLowerCase();
  const role = parseRole(field(form, "role")) ?? "MEMBER";
  const values = { email, role };

  const invitee = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true },
  });
  if (!invitee) {
    return {
      values,
      error: "Nenhuma conta com este e-mail. Peça para a pessoa criar a conta primeiro.",
    };
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
  await prisma.spaceMember.updateMany({
    where: { id: field(form, "memberId"), spaceId: space.id },
    data: { role },
  });
  revalidatePath(`/dashboard/${space.slug}`);
}

export async function removeMember(form: FormData) {
  const { space } = await requireAdmin(form);
  await prisma.spaceMember.deleteMany({ where: { id: field(form, "memberId"), spaceId: space.id } });
  revalidatePath(`/dashboard/${space.slug}`);
}
