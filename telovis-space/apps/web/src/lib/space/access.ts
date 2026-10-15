import "server-only";
import type { SpaceRole } from "@telovis/protocol";
import { prisma } from "@/lib/prisma";
import { getSpace, DEMO_SLUG, type SpaceConfig } from "./spaces";

export interface SpaceAccess {
  space: SpaceConfig;
  role: SpaceRole;
}

/** `SpaceMember.role` é String no banco; qualquer valor fora do enum = sem acesso. */
export function parseRole(value: unknown): SpaceRole | null {
  return value === "ADMIN" || value === "MEMBER" || value === "GUEST" ? value : null;
}

/**
 * Pode este usuário entrar neste space? Dono vale como ADMIN mesmo sem linha
 * em SpaceMember. O space demo é aberto a qualquer usuário logado, como GUEST.
 * Devolve null tanto para "não existe" quanto para "sem vínculo".
 */
export async function getSpaceAccess(slug: string, userId: string): Promise<SpaceAccess | null> {
  if (slug === DEMO_SLUG) {
    const space = await getSpace(slug);
    return space && { space, role: "GUEST" };
  }

  const row = await prisma.space.findUnique({
    where: { slug },
    select: {
      slug: true,
      name: true,
      mapJsonUrl: true,
      tilesetUrl: true,
      ownerId: true,
      members: { where: { userId }, select: { role: true }, take: 1 },
    },
  });
  if (!row) return null;

  const { ownerId, members, ...space } = row;
  if (ownerId === userId) return { space, role: "ADMIN" };
  const role = parseRole(members[0]?.role);
  return role && { space, role };
}

export interface UserSpace extends SpaceConfig {
  role: SpaceRole;
  isOwner: boolean;
}

/** Spaces do banco que o usuário pode abrir (dono ou membro), com o papel dele. */
export async function listUserSpaces(userId: string): Promise<UserSpace[]> {
  const rows = await prisma.space.findMany({
    where: { OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
    select: {
      slug: true,
      name: true,
      mapJsonUrl: true,
      tilesetUrl: true,
      ownerId: true,
      members: { where: { userId }, select: { role: true }, take: 1 },
    },
    orderBy: { name: "asc" },
  });

  const result: UserSpace[] = [];
  for (const { ownerId, members, ...space } of rows) {
    const isOwner = ownerId === userId;
    const role = isOwner ? "ADMIN" : parseRole(members[0]?.role);
    if (role) result.push({ ...space, role, isOwner });
  }
  return result;
}
