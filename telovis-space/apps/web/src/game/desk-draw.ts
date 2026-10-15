import { CHAIR_COLORS, DESK_SURFACES, SCREEN_COLORS, type DeskSetup } from "@telovis/protocol";

// Desenho da mesa de trabalho em canvas 2D puro (cena e prévia do setup).
// Vista de cima, 64×56: tampo nos 32px de cima (2×1 tiles, o objeto do mapa),
// cadeira logo abaixo — quem senta olha para cima, para as telas.
//
// Índices de DESK_MODELS / CHAIR_MODELS / DESK_SCREENS (packages/protocol):
const MODEL = { classic: 0, standing: 1, gamer: 2 } as const;
const CHAIR = { office: 0, gamer: 1, stool: 2 } as const;
const SCREENS = { laptop: 0, one: 1, two: 2, curved: 3, ultrawide: 4 } as const;

export const DESK_W = 64;
export const DESK_H = 32;
export const DESK_TEX_H = 56;

const OUTLINE = "#1f2433";
const RGB = ["#ef4444", "#f97316", "#facc15", "#22c55e", "#06b6d4", "#3b82f6", "#a855f7", "#ec4899"];

/** Chave estável da textura por combinação de setup (livre = sem itens). */
export function deskTextureKey(setup: DeskSetup, claimed: boolean): string {
  if (!claimed) return "desk-free";
  const s = setup;
  return `desk-${s.model}-${s.surface}-${s.screens}-${s.screenColor}-${s.chairModel}-${s.chair}-${s.plant}${s.mug}${s.lamp}`;
}

type Ctx = CanvasRenderingContext2D;

function painter(ctx: Ctx) {
  const rect = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };
  const box = (x: number, y: number, w: number, h: number, color: string) => {
    rect(x - 1, y - 1, w + 2, h + 2, OUTLINE);
    rect(x, y, w, h, color);
  };
  return { rect, box };
}

export function drawDesk(ctx: Ctx, setup: DeskSetup, claimed: boolean) {
  const { rect, box } = painter(ctx);
  const model = claimed ? setup.model : MODEL.classic;
  const surface = claimed ? DESK_SURFACES[setup.surface] : DESK_SURFACES[0];

  // Mesa em pé não tem cadeira: tapete antifadiga onde a pessoa fica.
  if (model === MODEL.standing) {
    rect(16, 37, 32, 14, "#374151");
    for (let x = 18; x < 46; x += 4) rect(x, 39, 2, 10, "#4b5563");
  } else {
    drawChair(ctx, claimed ? setup.chairModel : CHAIR.office, claimed ? CHAIR_COLORS[setup.chair] : "#64748b");
  }

  // Tampo. A mesa em pé tem sombra mais longa (está mais alta) e pés à mostra.
  if (model === MODEL.standing) {
    rect(4, 31, 60, 6, "rgba(0,0,0,0.3)");
    box(6, 30, 4, 5, "#6b7280");
    box(54, 30, 4, 5, "#6b7280");
  } else {
    rect(2, 30, 62, 3, "rgba(0,0,0,0.25)");
  }
  box(1, 3, 62, 27, surface);
  rect(1, 26, 62, 4, shade(surface, -0.2)); // borda da frente

  if (model === MODEL.gamer) {
    // Fita de LED na borda da frente.
    for (let i = 0; i < 62; i++) rect(1 + i, 28, 1, 1, RGB[Math.floor(i / 8) % RGB.length]);
  }
  if (model === MODEL.standing) {
    // Botoeira de subir/descer no canto da frente.
    box(48, 26, 8, 3, "#111827");
    rect(49, 27, 2, 1, "#f8fafc");
    rect(53, 27, 2, 1, "#f8fafc");
  }

  if (!claimed) return;

  drawScreens(ctx, setup, model === MODEL.gamer);

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

function drawScreens(ctx: Ctx, setup: DeskSetup, gamer: boolean) {
  const { rect, box } = painter(ctx);
  const bezel = SCREEN_COLORS[setup.screenColor];
  const stand = setup.screenColor === 0 ? "#374151" : "#9ca3af";

  if (setup.screens === SCREENS.laptop) {
    box(22, 7, 20, 9, bezel); // tela do notebook aberta
    rect(24, 9, 16, 5, "#60a5fa");
    box(22, 16, 20, 7, "#cbd5e1"); // base/teclado
    rect(24, 18, 16, 1, "#94a3b8");
    rect(24, 20, 16, 1, "#94a3b8");
    return;
  }

  if (setup.screens === SCREENS.curved || setup.screens === SCREENS.ultrawide) {
    const ultra = setup.screens === SCREENS.ultrawide;
    curvedMonitor(ctx, ultra ? 12 : 17, ultra ? 40 : 30, bezel);
    rect(30, 16, 4, 2, stand); // pé central
  } else {
    // Dois monitores ficam mais estreitos para deixar os cantos livres
    // (luminária à esquerda, planta à direita).
    const w = setup.screens === SCREENS.one ? 22 : 19;
    const monitors = setup.screens === SCREENS.one ? [21] : [13, 33];
    for (const x of monitors) {
      box(x, 5, w, 10, bezel);
      rect(x + 2, 7, w - 4, 6, "#3b82f6");
      rect(x + 3, 8, 6, 1, "#93c5fd");
      rect(x + Math.floor(w / 2) - 2, 15, 4, 2, stand); // pé
    }
  }

  if (gamer) {
    // Mousepad grande, teclado com teclas coloridas, mouse com LED.
    rect(20, 18, 32, 7, "#111827");
    box(22, 19, 18, 4, "#1f2937");
    for (let i = 0; i < 8; i++) rect(23 + i * 2, 20, 1, 2, RGB[i]);
    box(44, 19, 3, 4, "#1f2937");
    rect(45, 20, 1, 1, "#22c55e");
  } else {
    box(23, 19, 18, 4, "#e5e7eb"); // teclado
    rect(24, 20, 16, 1, "#9ca3af");
    box(44, 19, 3, 4, "#e5e7eb"); // mouse
  }
}

/**
 * Monitor curvo visto de cima/de frente: as pontas ficam 1–2px mais baixas
 * que o meio, desenhando um arco. Três faixas: pontas, transição e centro.
 */
function curvedMonitor(ctx: Ctx, x: number, w: number, bezel: string) {
  const { rect } = painter(ctx);
  const edge = Math.round(w / 6);
  const segments: [sx: number, sw: number, dy: number][] = [
    [x, edge, 2],
    [x + edge, edge, 1],
    [x + 2 * edge, w - 4 * edge, 0],
    [x + w - 2 * edge, edge, 1],
    [x + w - edge, edge, 2],
  ];
  for (const [sx, sw, dy] of segments) rect(sx - 1, 4 + dy, sw + 2, 12, OUTLINE);
  for (const [sx, sw, dy] of segments) {
    rect(sx, 5 + dy, sw, 10, bezel);
    rect(sx, 7 + dy, sw, 6, "#3b82f6");
  }
  // Bordas laterais da moldura e um reflexo.
  rect(x, 9, 1, 6, bezel);
  rect(x + w - 1, 9, 1, 6, bezel);
  rect(x + 2 * edge + 1, 8, 8, 1, "#93c5fd");
}

function drawChair(ctx: Ctx, model: number, color: string) {
  const { rect, box } = painter(ctx);
  // Cadeira atrás no desenho, para o tampo cobrir a borda de cima dela.
  if (model === CHAIR.stool) {
    rect(22, 47, 20, 3, "rgba(0,0,0,0.25)");
    box(24, 36, 16, 10, color);
    rect(24, 43, 16, 3, shade(color, -0.3));
    rect(27, 38, 10, 1, shade(color, 0.25));
    return;
  }
  if (model === CHAIR.gamer) {
    // Concha alta preta com faixas na cor escolhida (preta → faixas cinza).
    const accent = color === CHAIR_COLORS[6] ? "#6b7280" : color;
    rect(16, 53, 32, 3, "rgba(0,0,0,0.25)");
    box(19, 34, 26, 12, "#111827"); // assento
    rect(23, 35, 3, 11, accent);
    rect(38, 35, 3, 11, accent);
    box(18, 45, 28, 8, "#111827"); // encosto alto com "abas"
    rect(18, 45, 4, 8, accent);
    rect(42, 45, 4, 8, accent);
    box(28, 49, 8, 3, "#f8fafc"); // almofada do pescoço
    box(15, 36, 3, 8, "#1f2937"); // braços
    box(46, 36, 3, 8, "#1f2937");
    return;
  }
  rect(18, 52, 28, 3, "rgba(0,0,0,0.25)");
  box(20, 34, 24, 16, color);
  rect(20, 46, 24, 4, shade(color, -0.3)); // encosto (quem senta olha para cima)
  box(17, 36, 3, 9, shade(color, -0.15)); // braços
  box(44, 36, 3, 9, shade(color, -0.15));
}

function shade(color: string, amount: number): string {
  const n = parseInt(color.slice(1), 16);
  const ch = (shift: number) => {
    const v = (n >> shift) & 0xff;
    return Math.round(Math.max(0, Math.min(255, v + v * amount)));
  };
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}
