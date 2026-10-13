import "server-only";
import { SPACE_ID_PATTERN } from "@telovis/protocol";
import { prisma } from "@/lib/prisma";
import { parseRole } from "./access";
import { DEMO_SLUG } from "./spaces";

export { slugify } from "./slug";

export interface AdminSpace {
  id: string;
  slug: string;
  name: string;
  ownerId: string;
}

/**
 * O space, se o usuário pode administrá-lo (dono ou membro ADMIN); senão null.
 * Toda Server Action de gestão passa por aqui: a página esconder o botão não
 * basta, a action pode ser chamada direto.
 */
export async function getAdminSpace(slug: string, userId: string): Promise<AdminSpace | null> {
  if (slug === DEMO_SLUG) return null;
  const row = await prisma.space.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      ownerId: true,
      members: { where: { userId }, select: { role: true }, take: 1 },
    },
  });
  if (!row) return null;
  const { members, ...space } = row;
  if (space.ownerId === userId || parseRole(members[0]?.role) === "ADMIN") return space;
  return null;
}

// Slugs que colidiriam com rotas ou com o space de demonstração.
const RESERVED_SLUGS = new Set([DEMO_SLUG, "new", "api", "admin", "dashboard"]);

/** Mensagem de erro, ou null se o slug serve. */
export function checkSlug(slug: string): string | null {
  if (slug.length < 2 || !SPACE_ID_PATTERN.test(slug)) {
    return "Endereço inválido: use letras minúsculas, números e hífen (mínimo 2).";
  }
  if (RESERVED_SLUGS.has(slug)) return "Este endereço é reservado. Escolha outro.";
  return null;
}
