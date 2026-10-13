import {
  HAIR_COLORS,
  HAIR_STYLES,
  PANTS_COLORS,
  SHIRT_COLORS,
  SKIN_TONES,
  type AvatarLook,
  type Direction,
} from "@telovis/protocol";

// Desenho do avatar em canvas 2D puro, sem Phaser: usado pela cena (via
// avatar.ts) e pela prévia do Customizer.
//
// Layout do spritesheet: 12 quadros de 24×24 numa linha. Para cada direção
// (na ordem de DIR_ORDER) há 3 quadros: parado, passo A, passo B.

export const AVATAR_SIZE = 24;
export const DIR_ORDER: Direction[] = ["down", "left", "right", "up"];
export const FRAMES_PER_DIR = 3;
export const SHEET_FRAMES = DIR_ORDER.length * FRAMES_PER_DIR;

const OUTLINE = "#111827";

type Rect = [x: number, y: number, w: number, h: number, color: string];
type HairStyle = (typeof HAIR_STYLES)[number];

/** Chave estável por combinação de visual (cache de textura). */
export function avatarKey(look: AvatarLook): string {
  return `avatar-${look.skin}-${look.hair}-${look.hairStyle}-${look.shirt}-${look.pants}`;
}

/** Desenha o spritesheet inteiro a partir de (0, 0). */
export function drawAvatarSheet(ctx: CanvasRenderingContext2D, look: AvatarLook) {
  DIR_ORDER.forEach((dir, d) => {
    for (let f = 0; f < FRAMES_PER_DIR; f++) {
      drawAvatarFrame(ctx, (d * FRAMES_PER_DIR + f) * AVATAR_SIZE, dir, f, look);
    }
  });
}

/**
 * Desenha um quadro. Cada parte é um retângulo; primeiro todos os contornos
 * (retângulo 1px maior em cor escura), depois os preenchimentos — o resultado
 * é uma silhueta contornada, típica de pixel art.
 */
export function drawAvatarFrame(
  ctx: CanvasRenderingContext2D,
  ox: number,
  dir: Direction,
  frame: number,
  look: AvatarLook,
) {
  const skin = SKIN_TONES[look.skin];
  const hair = HAIR_COLORS[look.hair];
  const shirt = SHIRT_COLORS[look.shirt];
  const pants = PANTS_COLORS[look.pants];
  const shirtDark = shade(shirt, -0.25);
  const side = dir === "left" || dir === "right";
  // Passo A levanta a perna/braço "esquerdos" da tela, passo B os direitos.
  const liftA = frame === 1 ? 1 : 0;
  const liftB = frame === 2 ? 1 : 0;

  const parts: Rect[] = [];

  if (side) {
    // Perfil: pernas se abrem para frente/trás.
    const stride = frame === 0 ? 0 : 2;
    parts.push([10 - stride, 17, 3, 4, pants], [11 + stride, 17, 3, 4, pants]);
    parts.push([8, 11, 8, 7, shirt]);
    const armX = dir === "left" ? 12 : 10;
    parts.push([armX + (frame === 1 ? -1 : frame === 2 ? 1 : 0), 12, 2, 5, shirtDark]);
  } else {
    parts.push([8, 17, 3, 4 - liftA, pants], [13, 17, 3, 4 - liftB, pants]);
    parts.push([7, 11, 10, 7, shirt]);
    parts.push([5, 12 + liftB, 2, 5, shirtDark], [17, 12 + liftA, 2, 5, shirtDark]);
  }

  parts.push([7, 2, 10, 9, skin]);
  parts.push(...hairRects(HAIR_STYLES[look.hairStyle], dir, hair));

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

/** Cabelo por estilo e direção. Cabeça ocupa x 7..16, y 2..10. */
function hairRects(style: HairStyle, dir: Direction, c: string): Rect[] {
  if (style === "careca") return [];
  const long = style === "longo";
  switch (dir) {
    case "up":
      // De costas o cabelo cobre a cabeça; o longo desce até os ombros.
      return long ? [[7, 1, 10, 11, c]] : [[7, 1, 10, 8, c]];
    case "down":
      return long
        ? [[7, 1, 10, 3, c], [6, 3, 2, 9, c], [16, 3, 2, 9, c]]
        : [[7, 1, 10, 3, c], [7, 4, 1, 3, c], [16, 4, 1, 3, c]];
    case "left":
      return long ? [[7, 1, 10, 3, c], [12, 4, 6, 8, c]] : [[7, 1, 10, 3, c], [12, 4, 5, 4, c]];
    case "right":
      return long ? [[7, 1, 10, 3, c], [6, 4, 6, 8, c]] : [[7, 1, 10, 3, c], [7, 4, 5, 4, c]];
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
