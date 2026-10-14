import { CHAIR_COLORS, DESK_SURFACES, type DeskSetup } from "@telovis/protocol";

// Desenho da mesa de trabalho em canvas 2D puro (cena e prévia do setup).
// Vista de cima, 64×56: tampo nos 32px de cima (2×1 tiles, o objeto do mapa),
// cadeira logo abaixo — quem senta olha para cima, para as telas.

export const DESK_W = 64;
export const DESK_H = 32;
export const DESK_TEX_H = 56;

const OUTLINE = "#1f2433";

/** Chave estável da textura por combinação de setup (livre = sem itens). */
export function deskTextureKey(setup: DeskSetup, claimed: boolean): string {
  if (!claimed) return "desk-free";
  const s = setup;
  return `desk-${s.surface}-${s.screens}-${s.chair}-${s.plant}${s.mug}${s.lamp}`;
}

export function drawDesk(
  ctx: CanvasRenderingContext2D,
  setup: DeskSetup,
  claimed: boolean,
) {
  const rect = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };
  const box = (x: number, y: number, w: number, h: number, color: string) => {
    rect(x - 1, y - 1, w + 2, h + 2, OUTLINE);
    rect(x, y, w, h, color);
  };

  const surface = claimed ? DESK_SURFACES[setup.surface] : DESK_SURFACES[0];
  const chair = claimed ? CHAIR_COLORS[setup.chair] : "#64748b";

  // Cadeira (atrás no desenho, para o tampo cobrir a borda de cima dela).
  rect(18, 52, 28, 3, "rgba(0,0,0,0.25)");
  box(20, 34, 24, 16, chair);
  rect(20, 46, 24, 4, shade(chair, -0.3)); // encosto (quem senta olha para cima)
  box(17, 36, 3, 9, shade(chair, -0.15)); // braços
  box(44, 36, 3, 9, shade(chair, -0.15));

  // Tampo.
  rect(2, 30, 62, 3, "rgba(0,0,0,0.25)");
  box(1, 3, 62, 27, surface);
  rect(1, 26, 62, 4, shade(surface, -0.2)); // borda da frente

  if (!claimed) return;

  // Telas.
  if (setup.screens === 0) {
    box(22, 7, 20, 9, "#1e293b"); // tela do notebook aberta
    rect(24, 9, 16, 5, "#60a5fa");
    box(22, 16, 20, 7, "#cbd5e1"); // base/teclado
    rect(24, 18, 16, 1, "#94a3b8");
    rect(24, 20, 16, 1, "#94a3b8");
  } else {
    // Dois monitores ficam mais estreitos para deixar os cantos livres
    // (luminária à esquerda, planta à direita).
    const w = setup.screens === 1 ? 22 : 19;
    const monitors = setup.screens === 1 ? [21] : [13, 33];
    for (const x of monitors) {
      box(x, 5, w, 10, "#111827");
      rect(x + 2, 7, w - 4, 6, "#3b82f6");
      rect(x + 3, 8, 6, 1, "#93c5fd");
      rect(x + Math.floor(w / 2) - 2, 15, 4, 2, "#374151"); // pé
    }
    box(23, 19, 18, 4, "#e5e7eb"); // teclado
    rect(24, 20, 16, 1, "#9ca3af");
    box(44, 19, 3, 4, "#e5e7eb"); // mouse
  }

  if (setup.lamp) {
    box(4, 18, 6, 4, "#374151");
    rect(6, 10, 2, 8, "#374151");
    box(3, 6, 8, 5, "#facc15");
  }
  if (setup.mug) {
    box(51, 17, 6, 6, "#f8fafc");
    rect(52, 18, 4, 2, "#6b3f1d");
    rect(57, 19, 2, 2, "#f8fafc");
  }
  if (setup.plant) {
    box(54, 7, 6, 6, "#b45309");
    rect(53, 3, 8, 5, "#16a34a");
    rect(55, 2, 4, 2, "#22c55e");
  }
}

function shade(color: string, amount: number): string {
  const n = parseInt(color.slice(1), 16);
  const ch = (shift: number) => {
    const v = (n >> shift) & 0xff;
    return Math.round(Math.max(0, Math.min(255, v + v * amount)));
  };
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}
