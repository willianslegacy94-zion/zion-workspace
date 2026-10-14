// Mesa de trabalho pessoal: posições vêm da camada `desks` do mapa (o nome do
// objeto é a chave); cada pessoa pega no máximo uma por space e monta o setup.
// Mesmo esquema do avatar: índices em listas fixas, acrescentar só no fim.

export const DESK_SURFACES = ["#a87449", "#d9b38c", "#4b3621", "#e5e7eb"] as const;
export const DESK_SURFACE_NAMES = ["Madeira", "Clara", "Escura", "Branca"] as const;
export const DESK_SCREENS = ["Notebook", "1 monitor", "2 monitores"] as const;
export const CHAIR_COLORS = ["#334155", "#dc2626", "#2563eb", "#16a34a", "#f59e0b", "#a855f7"] as const;

export interface DeskSetup {
  surface: number;
  screens: number;
  chair: number;
  /** 0/1 */
  plant: number;
  mug: number;
  lamp: number;
}

const LIMITS: Record<keyof DeskSetup, number> = {
  surface: DESK_SURFACES.length,
  screens: DESK_SCREENS.length,
  chair: CHAIR_COLORS.length,
  plant: 2,
  mug: 2,
  lamp: 2,
};

export const DESK_SETUP_FIELDS = Object.keys(LIMITS) as (keyof DeskSetup)[];

export const DEFAULT_DESK_SETUP: DeskSetup = {
  surface: 0,
  screens: 1,
  chair: 0,
  plant: 0,
  mug: 1,
  lamp: 0,
};

export function parseDeskSetup(raw: unknown): DeskSetup | null {
  if (typeof raw !== "object" || raw === null) return null;
  const src = raw as Record<string, unknown>;
  const setup = {} as DeskSetup;
  for (const field of DESK_SETUP_FIELDS) {
    const v = src[field];
    if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v >= LIMITS[field]) return null;
    setup[field] = v;
  }
  return setup;
}

/** Chave da mesa = nome do objeto na camada `desks` do Tiled. */
export const DESK_KEY_PATTERN = /^[a-z0-9-]{1,32}$/;

export interface DeskOwner {
  userId: string;
  name: string;
}

/** Estado de uma mesa como o cliente desenha. Mesa livre: owner null. */
export interface DeskState {
  key: string;
  owner: DeskOwner | null;
  setup: DeskSetup;
}

export function freeDesk(key: string): DeskState {
  return { key, owner: null, setup: DEFAULT_DESK_SETUP };
}
