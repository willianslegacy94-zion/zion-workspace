import type { Direction, Vehicle } from "@telovis/protocol";
import { DIR_ORDER } from "./avatar-draw";

// Desenho dos veículos em canvas 2D puro (mesmo esquema do avatar).
//
// Spritesheet: 8 quadros de 32×32 numa linha; para cada direção (DIR_ORDER),
// 2 quadros que alternam as rodas em movimento. O ponto do jogador fica em
// (16, 12) do quadro — o mesmo centro do avatar de 24×24, deslocado 4px em x.
// Assim um pixel (ax, ay) do avatar corresponde a (ax + 4, ay) aqui.
//
// O kart é desenhado NA FRENTE do avatar (a carroceria cobre as pernas); o
// patinete, ATRÁS (o deck aparece sob os pés e o guidão pelos lados).

export const VEHICLE_FRAME = 32;
export const VEHICLE_ANCHOR = { x: 16, y: 12 } as const;
export const VEHICLE_FRAMES_PER_DIR = 2;
export const VEHICLE_SHEET_FRAMES = DIR_ORDER.length * VEHICLE_FRAMES_PER_DIR;

const OUTLINE = "#111827";
const TIRE = "#1f2937";
const TREAD = "#4b5563";

const KART = { body: "#dc2626", dark: "#991b1b", light: "#f87171", trim: "#facc15" };
const SCOOTER = { deck: "#0d9488", stem: "#94a3b8", grip: "#111827", light: "#5eead4" };

type Rect = [x: number, y: number, w: number, h: number, color: string];

export function vehicleTextureKey(vehicle: Vehicle): string {
  return `vehicle-${vehicle}`;
}

/** Quadro de uma direção; `phase` (0/1) alterna as rodas. */
export function vehicleFrame(direction: Direction, phase: number): number {
  return DIR_ORDER.indexOf(direction) * VEHICLE_FRAMES_PER_DIR + (phase % 2);
}

/** O kart cobre o avatar; o patinete fica por baixo. */
export function vehicleInFront(vehicle: Vehicle): boolean {
  return vehicle === "kart";
}

export function drawVehicleSheet(ctx: CanvasRenderingContext2D, vehicle: Vehicle) {
  DIR_ORDER.forEach((dir, d) => {
    for (let f = 0; f < VEHICLE_FRAMES_PER_DIR; f++) {
      const ox = (d * VEHICLE_FRAMES_PER_DIR + f) * VEHICLE_FRAME;
      const parts = vehicle === "kart" ? kartRects(dir, f) : scooterRects(dir, f);
      drawOutlined(ctx, ox, parts);
    }
  });
}

/** Mesmo truque do avatar: contornos primeiro, depois os preenchimentos. */
function drawOutlined(ctx: CanvasRenderingContext2D, ox: number, parts: Rect[]) {
  ctx.fillStyle = OUTLINE;
  for (const [x, y, w, h] of parts) ctx.fillRect(ox + x - 1, y - 1, w + 2, h + 2);
  for (const [x, y, w, h, color] of parts) {
    ctx.fillStyle = color;
    ctx.fillRect(ox + x, y, w, h);
  }
}

/** Pneu com sulco que "gira" trocando de posição entre os quadros. */
function tire(x: number, y: number, w: number, h: number, phase: number, vertical: boolean): Rect[] {
  const tread: Rect = vertical
    ? [x, y + 1 + phase * 2, w, 1, TREAD]
    : [x + 1 + phase * 2, y, 1, h, TREAD];
  return [[x, y, w, h, TIRE], tread];
}

function kartRects(dir: Direction, f: number): Rect[] {
  const { body, dark, light, trim } = KART;
  switch (dir) {
    case "down":
      // De frente: rodas da frente embaixo, para-choque e número.
      return [
        ...tire(3, 14, 4, 5, f, true),
        ...tire(25, 14, 4, 5, f, true),
        ...tire(4, 21, 4, 6, f, true),
        ...tire(24, 21, 4, 6, f, true),
        [7, 15, 18, 9, body],
        [7, 15, 18, 2, light],
        [9, 24, 14, 3, dark],
        [13, 18, 6, 4, "#f8fafc"],
        [15, 19, 2, 2, OUTLINE],
        [8, 23, 3, 1, trim],
        [21, 23, 3, 1, trim],
      ];
    case "up":
      // De costas: aerofólio e escapamentos.
      return [
        ...tire(3, 20, 5, 7, f, true),
        ...tire(24, 20, 5, 7, f, true),
        [8, 16, 16, 9, body],
        [6, 15, 20, 3, dark],
        [6, 15, 20, 1, trim],
        [11, 25, 3, 2, "#9ca3af"],
        [18, 25, 3, 2, "#9ca3af"],
        [9, 19, 14, 2, light],
      ];
    case "left":
    case "right": {
      const parts: Rect[] = [
        ...tire(4, 22, 7, 5, f, false),
        ...tire(21, 22, 7, 5, f, false),
        [3, 17, 26, 6, body],
        [3, 17, 26, 1, light],
        [3, 22, 26, 1, dark],
        [12, 19, 8, 2, trim],
      ];
      // Bico pontudo para o lado em que anda; volante na frente do piloto.
      const nose: Rect[] =
        dir === "right"
          ? [[28, 19, 3, 3, dark], [20, 14, 2, 4, "#374151"]]
          : [[1, 19, 3, 3, dark], [10, 14, 2, 4, "#374151"]];
      return [...parts, ...nose];
    }
  }
}

function scooterRects(dir: Direction, f: number): Rect[] {
  const { deck, stem, grip, light } = SCOOTER;
  switch (dir) {
    case "down":
      // Guidão aparece pelos lados do tronco; deck e roda da frente sob os pés.
      return [
        [7, 12, 18, 2, stem],
        [5, 12, 3, 2, grip],
        [24, 12, 3, 2, grip],
        [15, 12, 2, 14, stem],
        [11, 20, 10, 3, deck],
        [11, 20, 10, 1, light],
        ...tire(14, 24, 4, 4, f, true),
      ];
    case "up":
      return [
        [7, 12, 18, 2, stem],
        [5, 12, 3, 2, grip],
        [24, 12, 3, 2, grip],
        [11, 20, 10, 3, deck],
        [11, 20, 10, 1, light],
        ...tire(14, 23, 4, 4, f, true),
      ];
    case "left":
    case "right": {
      // Perfil: deck comprido, duas rodas, coluna na frente do piloto.
      const front = dir === "right";
      const stemX = front ? 23 : 8;
      return [
        ...tire(5, 23, 4, 4, f, false),
        ...tire(23, 23, 4, 4, f, false),
        [6, 21, 20, 2, deck],
        [6, 21, 20, 1, light],
        [stemX, 9, 2, 14, stem],
        [front ? 21 : 7, 8, 5, 2, grip],
      ];
    }
  }
}
