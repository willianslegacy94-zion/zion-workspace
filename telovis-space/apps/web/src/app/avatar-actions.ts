"use server";

import { redirect } from "next/navigation";
import { AVATAR_FIELDS, parseAvatarLook } from "@telovis/protocol";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, safeNext } from "@/lib/auth/session";
import { notifyRealtime } from "@/lib/realtime/notify";

export type AvatarFormState = { error?: string } | undefined;

export async function saveAvatar(_: AvatarFormState, form: FormData): Promise<AvatarFormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Campos chegam como texto; parseAvatarLook confere inteiro e faixa de cada um.
  const raw = Object.fromEntries(AVATAR_FIELDS.map((f) => [f, Number(form.get(f))]));
  const look = parseAvatarLook(raw);
  if (!look) return { error: "Visual inválido. Recarregue a página e tente de novo." };

  await prisma.user.update({ where: { id: user.id }, data: { avatar: { ...look } } });
  // Abas abertas em algum escritório trocam de visual na hora para todos.
  await notifyRealtime({ type: "avatar.updated", userId: user.id, avatar: look });
  redirect(safeNext(form.get("next"), "/"));
}
