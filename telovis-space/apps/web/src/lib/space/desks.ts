import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  DEFAULT_DESK_SETUP,
  DESK_KEY_PATTERN,
  parseDeskSetup,
  type DeskState,
} from "@telovis/protocol";
import { prisma } from "@/lib/prisma";

const PUBLIC_DIR = path.join(process.cwd(), "public");
const deskKeysCache = new Map<string, Promise<Set<string>>>();

async function loadMapJson(mapJsonUrl: string): Promise<unknown> {
  if (/^https?:\/\//.test(mapJsonUrl)) {
    const res = await fetch(mapJsonUrl);
    if (!res.ok) throw new Error(`mapa ${mapJsonUrl}: HTTP ${res.status}`);
    return res.json();
  }
  // Caminho relativo ao /public; nada de sair dele.
  const file = path.resolve(PUBLIC_DIR, `.${mapJsonUrl}`);
  if (!file.startsWith(PUBLIC_DIR + path.sep)) throw new Error(`mapa fora de /public: ${mapJsonUrl}`);
  return JSON.parse(await readFile(file, "utf8"));
}

/**
 * Chaves das mesas do mapa (nomes dos objetos da camada `desks`). O servidor
 * só aceita pegar mesas que existem no mapa do space.
 */
export function getDeskKeys(mapJsonUrl: string): Promise<Set<string>> {
  let cached = deskKeysCache.get(mapJsonUrl);
  if (!cached) {
    cached = loadMapJson(mapJsonUrl).then((map) => {
      const layers = (map as { layers?: { name?: string; objects?: { name?: string }[] }[] }).layers;
      const objects = layers?.find((l) => l.name === "desks")?.objects ?? [];
      return new Set(objects.map((o) => o.name ?? "").filter((n) => DESK_KEY_PATTERN.test(n)));
    });
    // Falha não fica em cache: a próxima chamada tenta de novo.
    cached.catch(() => deskKeysCache.delete(mapJsonUrl));
    deskKeysCache.set(mapJsonUrl, cached);
  }
  return cached;
}

type DeskRow = { key: string; setup: unknown; user: { id: string; name: string } };

export function toDeskState(row: DeskRow): DeskState {
  return {
    key: row.key,
    owner: { userId: row.user.id, name: row.user.name },
    setup: parseDeskSetup(row.setup) ?? DEFAULT_DESK_SETUP,
  };
}

export const DESK_ROW_SELECT = {
  key: true,
  setup: true,
  user: { select: { id: true, name: true } },
} as const;

/** Mesas com dono no space (as livres o cliente deduz do mapa). */
export async function listClaimedDesks(spaceSlug: string): Promise<DeskState[]> {
  const rows = await prisma.desk.findMany({
    where: { space: { slug: spaceSlug } },
    select: DESK_ROW_SELECT,
  });
  return rows.map(toDeskState);
}
