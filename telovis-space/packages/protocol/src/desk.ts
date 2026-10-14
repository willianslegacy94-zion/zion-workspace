// Mesa de trabalho pessoal: posições vêm da camada `desks` do mapa (o nome do
// objeto é a chave); cada pessoa pega no máximo uma por space e monta o setup.
// Mesmo esquema do avatar: índices em listas fixas, acrescentar só no fim.

export const DESK_SURFACES = [
  "#a87449", "#d9b38c", "#4b3621", "#e5e7eb",
  "#1f2937", "#9ca3af", "#f9a8d4", "#5eead4",
] as const;
export const DESK_SURFACE_NAMES = [
  "Madeira", "Clara", "Escura", "Branca",
  "Preta", "Cinza", "Rosa", "Verde-água",
] as const;
export const DESK_SCREENS = ["Notebook", "1 monitor", "2 monitores", "Monitor curvo", "Ultrawide curvo"] as const;
export const CHAIR_COLORS = [
  "#334155", "#dc2626", "#2563eb", "#16a34a", "#f59e0b", "#a855f7",
  "#111827", "#f8fafc", "#ec4899", "#06b6d4",
] as const;
/** Em pé: tampo alto, sem cadeira. Gamer: tampo escuro com fita de LED. */
export const DESK_MODELS = ["Clássica", "Em pé", "Gamer"] as const;
export const CHAIR_MODELS = ["Escritório", "Gamer", "Banqueta"] as const;
export const SCREEN_COLORS = ["#111827", "#e5e7eb"] as const;
export const SCREEN_COLOR_NAMES = ["Preto", "Branco"] as const;

export interface DeskSetup {
  surface: number;
  screens: number;
  chair: number;
  /** 0/1 */
  plant: number;
  mug: number;
  lamp: number;
  model: number;
  chairModel: number;
  screenColor: number;
}

const LIMITS: Record<keyof DeskSetup, number> = {
  surface: DESK_SURFACES.length,
  screens: DESK_SCREENS.length,
  chair: CHAIR_COLORS.length,
  plant: 2,
  mug: 2,
  lamp: 2,
  model: DESK_MODELS.length,
  chairModel: CHAIR_MODELS.length,
  screenColor: SCREEN_COLORS.length,
};

export const DESK_SETUP_FIELDS = Object.keys(LIMITS) as (keyof DeskSetup)[];

export const DEFAULT_DESK_SETUP: DeskSetup = {
  surface: 0,
  screens: 1,
  chair: 0,
  plant: 0,
  mug: 1,
  lamp: 0,
  model: 0,
  chairModel: 0,
  screenColor: 0,
};

/**
 * Campos acrescentados depois que já havia mesas salvas: quando faltam no
 * JSON guardado, valem o padrão. (Campo novo sempre entra aqui.)
 */
const ADDED_LATER = new Set<keyof DeskSetup>(["model", "chairModel", "screenColor"]);

export function parseDeskSetup(raw: unknown): DeskSetup | null {
  if (typeof raw !== "object" || raw === null) return null;
  const src = raw as Record<string, unknown>;
  const setup = {} as DeskSetup;
  for (const field of DESK_SETUP_FIELDS) {
    const v = src[field] === undefined && ADDED_LATER.has(field) ? DEFAULT_DESK_SETUP[field] : src[field];
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
