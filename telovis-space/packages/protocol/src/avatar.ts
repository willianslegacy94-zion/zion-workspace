// Visual do avatar: índices em paletas fixas, não cores livres. Assim web,
// realtime e banco validam a mesma coisa, e ninguém injeta valor arbitrário.
//
// Ao acrescentar opções, sempre no FIM das listas: os índices salvos no banco
// precisam continuar apontando para a mesma cor.

export const SKIN_TONES = ["#f5d0b5", "#e0ac83", "#c68642", "#8d5524", "#f1c27d", "#5c3a21"] as const;
export const HAIR_COLORS = [
  "#2b1d14",
  "#4a3020",
  "#a0522d",
  "#e3c16f",
  "#1f2937",
  "#b91c1c",
  "#d1d5db",
] as const;
export const SHIRT_COLORS = [
  "#3b82f6",
  "#f97316",
  "#a855f7",
  "#ec4899",
  "#eab308",
  "#14b8a6",
  "#ef4444",
  "#22c55e",
  "#f8fafc",
  "#1e293b",
] as const;
export const PANTS_COLORS = ["#374151", "#1e3a8a", "#78350f", "#111827", "#9ca3af"] as const;
export const HAIR_STYLES = ["curto", "longo", "careca"] as const;

export interface AvatarLook {
  skin: number;
  hair: number;
  hairStyle: number;
  shirt: number;
  pants: number;
}

const LIMITS: Record<keyof AvatarLook, number> = {
  skin: SKIN_TONES.length,
  hair: HAIR_COLORS.length,
  hairStyle: HAIR_STYLES.length,
  shirt: SHIRT_COLORS.length,
  pants: PANTS_COLORS.length,
};

export const AVATAR_FIELDS = Object.keys(LIMITS) as (keyof AvatarLook)[];

/** Quantas opções cada campo tem (para o Customizer). */
export function avatarOptionCount(field: keyof AvatarLook): number {
  return LIMITS[field];
}

/** Valida um valor vindo de fora (banco, ticket, formulário). */
export function parseAvatarLook(raw: unknown): AvatarLook | null {
  if (typeof raw !== "object" || raw === null) return null;
  const src = raw as Record<string, unknown>;
  const look = {} as AvatarLook;
  for (const field of AVATAR_FIELDS) {
    const v = src[field];
    if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v >= LIMITS[field]) return null;
    look[field] = v;
  }
  return look;
}

/**
 * Visual de quem nunca abriu o Customizer: derivado do nome, então todo mundo
 * vê a mesma pessoa com a mesma cara. Reproduz o visual anterior ao Customizer.
 */
export function defaultAvatarLook(name: string): AvatarLook {
  const h = hash(name);
  return {
    skin: h % 5,
    hair: (h >>> 3) % 5,
    hairStyle: 0,
    shirt: h % 8,
    pants: 0,
  };
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
