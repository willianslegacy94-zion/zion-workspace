"use server";

import {
  DEFAULT_DESK_SETUP,
  freeDesk,
  parseDeskSetup,
  type DeskState,
} from "@telovis/protocol";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { notifyRealtime } from "@/lib/realtime/notify";
import { getSpaceAccess } from "@/lib/space/access";
import { DESK_ROW_SELECT, getDeskKeys, toDeskState } from "@/lib/space/desks";
import { DEMO_SLUG } from "@/lib/space/spaces";

// Chamadas direto pelo cliente (SpaceClient): slug, chave e setup chegam do
// navegador e são validados aqui, junto com sessão e papel no space.

export type DeskActionResult = { ok: true; desk: DeskState | null } | { ok: false; error: string };

class DeskTakenError extends Error {}

interface DeskContext {
  ok: true;
  userId: string;
  spaceId: string;
  slug: string;
  mapJsonUrl: string;
}

async function deskContext(slug: unknown): Promise<DeskContext | { ok: false; error: string }> {
  const fail = (error: string) => ({ ok: false as const, error });
  if (typeof slug !== "string") return fail("Escritório inválido.");
  const user = await getCurrentUser();
  if (!user) return fail("Sessão expirada. Entre de novo.");
  if (slug === DEMO_SLUG) {
    return fail("O escritório demo é compartilhado: mesas fixas só nos escritórios da equipe.");
  }
  const access = await getSpaceAccess(slug, user.id);
  if (!access) return fail("Sem acesso a este escritório.");
  if (access.role === "GUEST") return fail("Convidados não têm mesa fixa.");
  const space = await prisma.space.findUnique({ where: { slug }, select: { id: true } });
  if (!space) return fail("Sem acesso a este escritório.");
  return { ok: true, userId: user.id, spaceId: space.id, slug, mapJsonUrl: access.space.mapJsonUrl };
}

async function broadcast(space: string, desk: DeskState) {
  await notifyRealtime({ type: "desk.updated", space, desk });
}

/** Pega uma mesa livre. Quem já tinha outra muda de lugar levando o setup. */
export async function claimDesk(slug: string, key: string): Promise<DeskActionResult> {
  const ctx = await deskContext(slug);
  if (!ctx.ok) return ctx;
  if (typeof key !== "string" || !(await getDeskKeys(ctx.mapJsonUrl)).has(key)) {
    return { ok: false, error: "Mesa inexistente neste mapa." };
  }

  try {
    const { previousKey, row } = await prisma.$transaction(async (tx) => {
      const where = { spaceId_key: { spaceId: ctx.spaceId, key } };
      const current = await tx.desk.findUnique({ where, select: { userId: true } });
      if (current && current.userId !== ctx.userId) throw new DeskTakenError();
      if (current) {
        return { previousKey: null, row: await tx.desk.findUniqueOrThrow({ where, select: DESK_ROW_SELECT }) };
      }

      const mine = { spaceId_userId: { spaceId: ctx.spaceId, userId: ctx.userId } };
      const previous = await tx.desk.findUnique({ where: mine, select: { key: true, setup: true } });
      if (previous) await tx.desk.delete({ where: mine });
      const row = await tx.desk.create({
        data: {
          spaceId: ctx.spaceId,
          key,
          userId: ctx.userId,
          setup: (previous?.setup ?? { ...DEFAULT_DESK_SETUP }) as Prisma.InputJsonValue,
        },
        select: DESK_ROW_SELECT,
      });
      return { previousKey: previous?.key ?? null, row };
    });

    const desk = toDeskState(row);
    if (previousKey) await broadcast(ctx.slug, freeDesk(previousKey));
    await broadcast(ctx.slug, desk);
    return { ok: true, desk };
  } catch (err) {
    // P2002: duas pessoas pegando a mesma mesa ao mesmo tempo.
    const raced = err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
    if (err instanceof DeskTakenError || raced) return { ok: false, error: "Esta mesa já tem dono." };
    throw err;
  }
}

export async function updateDeskSetup(slug: string, rawSetup: unknown): Promise<DeskActionResult> {
  const ctx = await deskContext(slug);
  if (!ctx.ok) return ctx;
  const setup = parseDeskSetup(rawSetup);
  if (!setup) return { ok: false, error: "Setup inválido." };

  const mine = { spaceId_userId: { spaceId: ctx.spaceId, userId: ctx.userId } };
  const exists = await prisma.desk.findUnique({ where: mine, select: { id: true } });
  if (!exists) return { ok: false, error: "Você ainda não tem mesa neste escritório." };

  const row = await prisma.desk.update({ where: mine, data: { setup: { ...setup } }, select: DESK_ROW_SELECT });
  const desk = toDeskState(row);
  await broadcast(ctx.slug, desk);
  return { ok: true, desk };
}

export async function releaseDesk(slug: string): Promise<DeskActionResult> {
  const ctx = await deskContext(slug);
  if (!ctx.ok) return ctx;
  const mine = { spaceId_userId: { spaceId: ctx.spaceId, userId: ctx.userId } };
  const previous = await prisma.desk.findUnique({ where: mine, select: { key: true } });
  if (!previous) return { ok: true, desk: null };
  await prisma.desk.delete({ where: mine });
  const desk = freeDesk(previous.key);
  await broadcast(ctx.slug, desk);
  return { ok: true, desk };
}
