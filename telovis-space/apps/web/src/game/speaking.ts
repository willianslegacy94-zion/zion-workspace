import type Phaser from "phaser";

/**
 * Balão "falando" sobre a cabeça do avatar: pixel art com três pontinhos que
 * sobem um de cada vez. Desenhado em runtime, como avatares e veículos.
 */

export const SPEAKING_FRAMES = 3;
export const SPEAKING_FRAME_MS = 160;

const W = 16;
const BODY_H = 11;
const H = BODY_H + 3; // + rabinho
const FILL = 0xf8fafc;
const OUTLINE = 0x0f172a;
const DOT = 0x10b981; // esmeralda: mesma cor de "mídia ativa" da HUD

export function speakingKey(frame: number): string {
  return `speaking-${frame}`;
}

/** Cria as texturas uma vez por cena; chamadas seguintes não fazem nada. */
export function ensureSpeaking(scene: Phaser.Scene): void {
  for (let frame = 0; frame < SPEAKING_FRAMES; frame++) {
    const key = speakingKey(frame);
    if (scene.textures.exists(key)) continue;

    const g = scene.make.graphics({}, false);
    // Contorno: o corpo e o rabinho desenhados 1px maiores por baixo.
    g.fillStyle(OUTLINE);
    g.fillRect(1, 0, W - 2, BODY_H);
    g.fillRect(0, 1, W, BODY_H - 2);
    g.fillRect(3, BODY_H, 4, 2);
    g.fillRect(3, BODY_H + 2, 2, 1);
    // Corpo.
    g.fillStyle(FILL);
    g.fillRect(2, 1, W - 4, BODY_H - 2);
    g.fillRect(1, 2, W - 2, BODY_H - 4);
    g.fillRect(4, BODY_H - 1, 2, 2);
    // Pontinhos; o da vez sobe 1px.
    g.fillStyle(DOT);
    for (let i = 0; i < 3; i++) {
      const y = i === frame ? 4 : 5;
      g.fillRect(4 + i * 3, y, 2, 2);
    }
    g.generateTexture(key, W, H);
    g.destroy();
  }
}
