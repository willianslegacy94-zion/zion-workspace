import "server-only";

export interface SpaceConfig {
  slug: string;
  name: string;
  mapJsonUrl: string;
  tilesetUrl: string;
}

export const DEMO_SLUG = "demo";

/** Mapa usado pelo demo e pelos spaces novos enquanto não há upload de mapa. */
export const DEFAULT_MAP = {
  mapJsonUrl: "/assets/maps/office.json",
  tilesetUrl: "/assets/tilesets/office-tiles.png",
} as const;

// Space de demonstração servido de /public, sem linha no banco.
const DEMO_SPACE: SpaceConfig = {
  slug: DEMO_SLUG,
  name: "TeloVis HQ (demo)",
  ...DEFAULT_MAP,
};

export async function getSpace(slug: string): Promise<SpaceConfig | null> {
  if (slug === DEMO_SPACE.slug) return DEMO_SPACE;
  if (!process.env.DATABASE_URL) return null;

  const { prisma } = await import("@/lib/prisma");
  const space = await prisma.space.findUnique({
    where: { slug },
    select: { slug: true, name: true, mapJsonUrl: true, tilesetUrl: true },
  });
  return space;
}
