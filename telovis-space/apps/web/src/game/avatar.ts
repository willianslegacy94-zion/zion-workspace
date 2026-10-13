import type Phaser from "phaser";
import type { Direction } from "@telovis/protocol";

// Avatares pixel art desenhados em runtime, um spritesheet por combinação de
// cores. Placeholder até o Customizer gerar spritesheets reais — quando isso
// existir, basta trocar ensureAvatar() por um load.spritesheet() com o mesmo
// layout de quadros abaixo.
//
// Layout: 12 quadros de 24×24 numa linha. Para cada direção (na ordem de
// DIR_ORDER) há 3 quadros: parado, passo A, passo B.

export const AVATAR_SIZE = 24;

const DIR_ORDER: Direction[] = ["down", "left", "right", "up"];
const FRAMES_PER_DIR = 3;
const OUTLINE = "#111827";
const PANTS = "#374151";
const SKIN_TONES = ["#f5d0b5", "#e0ac83", "#c68642", "#8d5524", "#f1c27d"];
const HAIR_COLORS = ["#2b1d14", "#4a3020", "#a0522d", "#e3c16f", "#1f2937"];

export interface AvatarLook {
  shirt: number;
  skin: string;
  hair: string;
}

export function lookFor(id: string, shirt: number): AvatarLook {
  const h = hash(id);
  return {
    shirt,
    skin: SKIN_TONES[h % SKIN_TONES.length],
    hair: HAIR_COLORS[(h >>> 3) % HAIR_COLORS.length],
  };
}

export function idleFrame(direction: Direction): number {
  return DIR_ORDER.indexOf(direction) * FRAMES_PER_DIR;
}

export function walkAnimKey(textureKey: string, direction: Direction): string {
  return `${textureKey}-walk-${direction}`;
}

/** Gera (uma vez) o spritesheet e as animações de caminhada do visual. */
export function ensureAvatar(scene: Phaser.Scene, look: AvatarLook): string {
  const key = `avatar-${look.shirt.toString(16)}-${look.skin.slice(1)}-${look.hair.slice(1)}`;
  if (scene.textures.exists(key)) return key;

  const total = DIR_ORDER.length * FRAMES_PER_DIR;
  const tex = scene.textures.createCanvas(key, AVATAR_SIZE * total, AVATAR_SIZE);
  if (!tex) throw new Error("Falha ao criar a textura do avatar");
  const ctx = tex.getContext();

  DIR_ORDER.forEach((dir, d) => {
    for (let f = 0; f < FRAMES_PER_DIR; f++) {
      drawFrame(ctx, (d * FRAMES_PER_DIR + f) * AVATAR_SIZE, dir, f, look);
    }
  });
  tex.refresh();
  for (let i = 0; i < total; i++) {
    tex.add(i, 0, i * AVATAR_SIZE, 0, AVATAR_SIZE, AVATAR_SIZE);
  }

  DIR_ORDER.forEach((dir, d) => {
    const base = d * FRAMES_PER_DIR;
    scene.anims.create({
      key: walkAnimKey(key, dir),
      frames: [1, 0, 2, 0].map((f) => ({ key, frame: base + f })),
      frameRate: 8,
      repeat: -1,
    });
  });

  return key;
}

type Rect = [x: number, y: number, w: number, h: number, color: string];

/**
 * Desenha um quadro. Cada parte é um retângulo; primeiro todos os contornos
 * (retângulo 1px maior em cor escura), depois os preenchimentos — o resultado
 * é uma silhueta contornada, típica de pixel art.
 */
function drawFrame(
  ctx: CanvasRenderingContext2D,
  ox: number,
  dir: Direction,
  frame: number,
  look: AvatarLook,
) {
  const shirt = `#${look.shirt.toString(16).padStart(6, "0")}`;
  const shirtDark = shade(shirt, -0.25);
  const side = dir === "left" || dir === "right";
  // Passo A levanta a perna/braço "esquerdos" da tela, passo B os direitos.
  const liftA = frame === 1 ? 1 : 0;
  const liftB = frame === 2 ? 1 : 0;

  const parts: Rect[] = [];

  if (side) {
    // Perfil: pernas se abrem para frente/trás.
    const stride = frame === 0 ? 0 : 2;
    parts.push([10 - stride, 17, 3, 4, PANTS], [11 + stride, 17, 3, 4, PANTS]);
    parts.push([8, 11, 8, 7, shirt]);
    const armX = dir === "left" ? 12 : 10;
    parts.push([armX + (frame === 1 ? -1 : frame === 2 ? 1 : 0), 12, 2, 5, shirtDark]);
  } else {
    parts.push([8, 17, 3, 4 - liftA, PANTS], [13, 17, 3, 4 - liftB, PANTS]);
    parts.push([7, 11, 10, 7, shirt]);
    parts.push([5, 12 + liftB, 2, 5, shirtDark], [17, 12 + liftA, 2, 5, shirtDark]);
  }

  // Cabeça + cabelo (o cabelo muda conforme a direção).
  parts.push([7, 2, 10, 9, look.skin]);
  if (dir === "up") parts.push([7, 1, 10, 8, look.hair]);
  else if (dir === "down") parts.push([7, 1, 10, 3, look.hair], [7, 4, 1, 3, look.hair], [16, 4, 1, 3, look.hair]);
  else if (dir === "left") parts.push([7, 1, 10, 3, look.hair], [12, 4, 5, 4, look.hair]);
  else parts.push([7, 1, 10, 3, look.hair], [7, 4, 5, 4, look.hair]);

  // Sombra no chão (sem contorno).
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(ox + 6, 21, 12, 2);

  ctx.fillStyle = OUTLINE;
  for (const [x, y, w, h] of parts) ctx.fillRect(ox + x - 1, y - 1, w + 2, h + 2);
  for (const [x, y, w, h, color] of parts) {
    ctx.fillStyle = color;
    ctx.fillRect(ox + x, y, w, h);
  }

  // Olhos.
  ctx.fillStyle = OUTLINE;
  if (dir === "down") {
    ctx.fillRect(ox + 9, 6, 1, 2);
    ctx.fillRect(ox + 14, 6, 1, 2);
  } else if (dir === "left") {
    ctx.fillRect(ox + 8, 6, 1, 2);
  } else if (dir === "right") {
    ctx.fillRect(ox + 15, 6, 1, 2);
  }
}

function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (shift: number) => {
    const v = (n >> shift) & 0xff;
    return Math.round(Math.max(0, Math.min(255, v + v * amount)));
  };
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
