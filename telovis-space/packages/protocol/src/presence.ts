// Status de ausência exibido sobre o avatar. Só existe enquanto a pessoa está
// conectada (não vai para o banco); null = disponível.

export const AWAY_STATUSES = ["away", "brb", "lunch", "coffee"] as const;
export type AwayStatus = (typeof AWAY_STATUSES)[number];

export const AWAY_STATUS_LABELS: Record<AwayStatus, string> = {
  away: "Ausente",
  brb: "Volto já",
  lunch: "Almoço",
  coffee: "Café",
};

/** Ausência automática após este tempo sem teclado/mouse (ou aba escondida). */
export const AUTO_AWAY_MS = 5 * 60_000;

export function isAwayStatus(v: unknown): v is AwayStatus {
  return typeof v === "string" && (AWAY_STATUSES as readonly string[]).includes(v);
}
