// Algoritmo de proximidade (spec, seções 3.2 e 3.3).
//
// Função pura, sem Phaser nem LiveKit: recebe posições e devolve, para cada
// avatar remoto, se a mídia dele deve estar ativa e com que volume. A cena
// chama isso em intervalo fixo e o MediaController aplica o resultado.

import { EARSHOT_RADIUS } from "@telovis/protocol";

export interface ProximityConfig {
  /** Raio para ATIVAR a mídia de um colega (spec: 150px). */
  activationRadius: number;
  /**
   * Raio para DESATIVAR uma mídia que já está ativa. Ligeiramente maior que o
   * de ativação (histerese): sem isso, alguém parado na borda dos 150px faz a
   * assinatura ligar/desligar a cada frame com qualquer tremida de posição.
   */
  deactivationRadius: number;
  /** Abaixo desta distância o volume fica em 100%. */
  fullVolumeRadius: number;
}

export const DEFAULT_PROXIMITY: ProximityConfig = {
  activationRadius: EARSHOT_RADIUS,
  deactivationRadius: EARSHOT_RADIUS + 20,
  fullVolumeRadius: 40,
};

export interface Positioned {
  id: string;
  x: number;
  y: number;
  zoneId: string | null;
}

export type DecisionReason =
  | "same-zone" // os dois na mesma zona privada
  | "zone-isolated" // um dos dois está numa zona privada e o outro não está nela
  | "in-range" // fora de zonas, dentro do raio
  | "out-of-range"; // fora de zonas, fora do raio

export interface MediaDecision {
  active: boolean;
  /** 0..1, aplicado ao áudio do colega. */
  volume: number;
  distance: number;
  reason: DecisionReason;
}

export type MediaDecisions = Map<string, MediaDecision>;

/** d = √((x₂ − x₁)² + (y₂ − y₁)²) */
export function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * Volume em função da distância: 100% até `fullVolumeRadius`, caindo até 0 no
 * raio de ativação. A queda é quadrática porque a percepção de volume é
 * logarítmica — uma queda linear soa "alto demais" até perto da borda.
 */
export function volumeForDistance(d: number, cfg: ProximityConfig = DEFAULT_PROXIMITY): number {
  if (d <= cfg.fullVolumeRadius) return 1;
  if (d >= cfg.activationRadius) return 0;
  const t = (d - cfg.fullVolumeRadius) / (cfg.activationRadius - cfg.fullVolumeRadius);
  return (1 - t) ** 2;
}

/**
 * Decide a mídia de cada avatar remoto em relação ao avatar local.
 *
 * Regras, em ordem:
 * 1. Se algum dos dois está em zona privada, a distância é ignorada: a mídia
 *    só fica ativa se ambos estão na MESMA zona (volume cheio — é uma sala).
 *    Quem está fora não ouve quem está dentro, e vice-versa.
 * 2. Fora de zonas, vale o raio: ativa se d ≤ raio, com volume pela distância.
 *    O raio usado depende do estado anterior (histerese).
 *
 * @param previous decisões da rodada anterior, para a histerese.
 */
export function decideMedia(
  local: Positioned,
  remotes: Iterable<Positioned>,
  previous: ReadonlyMap<string, MediaDecision> = new Map(),
  cfg: ProximityConfig = DEFAULT_PROXIMITY,
): MediaDecisions {
  const decisions: MediaDecisions = new Map();

  for (const remote of remotes) {
    if (remote.id === local.id) continue;
    const d = distance(local, remote);

    if (local.zoneId !== null || remote.zoneId !== null) {
      const sameZone = local.zoneId === remote.zoneId;
      decisions.set(remote.id, {
        active: sameZone,
        volume: sameZone ? 1 : 0,
        distance: d,
        reason: sameZone ? "same-zone" : "zone-isolated",
      });
      continue;
    }

    const wasActive = previous.get(remote.id)?.active ?? false;
    const radius = wasActive ? cfg.deactivationRadius : cfg.activationRadius;
    const active = d <= radius;
    decisions.set(remote.id, {
      active,
      volume: active ? volumeForDistance(d, cfg) : 0,
      distance: d,
      reason: active ? "in-range" : "out-of-range",
    });
  }

  return decisions;
}
