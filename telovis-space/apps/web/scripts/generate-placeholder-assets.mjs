// Gera o mapa Tiled (.json) e o tileset (.png) do escritório padrão, no mesmo
// formato que o Tiled exporta. Substitua por assets de pixel art de verdade
// quando existirem — a cena só depende dos nomes das camadas:
//   floor, walls, furniture, decor (tile layers)
//   zones, areas, desks, vehicles, objects (object layers)
//
// - walls/furniture colidem; decor (cadeiras, puffs) não.
// - zones: salas privadas (propriedade zoneId) — áudio só entre quem está dentro.
// - areas: áreas abertas com nome no chão (cozinha, café…), áudio por proximidade.
// - desks: posições de mesa que cada pessoa pode pegar e montar (nome = id).
// - vehicles: garagens; pontos chamados "kart" ou "patinete".
// - objects: ponto "spawn".
//
// Uso: node scripts/generate-placeholder-assets.mjs

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "assets");
const TILE = 32;
const W = 50;
const H = 32;

// --- Tileset ------------------------------------------------------------------
// Cada tile é pintado com retângulos; o índice no array = gid - 1.

const T = {
  wood: 1,
  wall: 2,
  carpet: 3,
  kitchenFloor: 4,
  rug: 5,
  meetingTable: 6,
  counter: 7,
  sink: 8,
  stove: 9,
  fridge: 10,
  coffeeMachine: 11,
  sofaBackTop: 12,
  sofaBackBottom: 13,
  coffeeTable: 14,
  plant: 15,
  bookshelf: 16,
  reception: 17,
  whiteboard: 18,
  diningTable: 19,
  chair: 20,
  beanbag: 21,
  tileFloor: 22,
  parkingSign: 23,
};
const TILES = Object.keys(T).length;
const img = Buffer.alloc(TILES * TILE * TILE * 4);

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), 255];

function painter(gid) {
  const ox = (gid - 1) * TILE;
  const put = (x, y, c) => {
    if (x < 0 || y < 0 || x >= TILE || y >= TILE) return;
    const i = (y * TILES * TILE + ox + x) * 4;
    img.set(c, i);
  };
  const rect = (x, y, w, h, color) => {
    const c = hex(color);
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) put(i, j, c);
  };
  /** Retângulo com contorno escuro de 1px. */
  const box = (x, y, w, h, color, outline = "#1f2433") => {
    rect(x, y, w, h, outline);
    rect(x + 1, y + 1, w - 2, h - 2, color);
  };
  const circle = (cx, cy, r, color) => {
    const c = hex(color);
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (i * i + j * j <= r * r) put(cx + i, cy + j, c);
  };
  return { rect, box, circle, put: (x, y, color) => put(x, y, hex(color)) };
}

// Pisos
{
  const p = painter(T.wood);
  p.rect(0, 0, 32, 32, "#c8a27a");
  for (let y = 0; y < 32; y += 8) {
    p.rect(0, y, 32, 1, "#a9845e");
    const seam = (y / 8) % 2 ? 10 : 24;
    p.rect(seam, y, 1, 8, "#a9845e");
  }
  p.rect(4, 3, 3, 1, "#d6b48e");
  p.rect(18, 19, 4, 1, "#d6b48e");
}
{
  const p = painter(T.carpet);
  p.rect(0, 0, 32, 32, "#4f6a9a");
  for (let y = 1; y < 32; y += 4) for (let x = (y % 8 === 1 ? 1 : 3); x < 32; x += 4) p.put(x, y, "#5b77a8");
}
{
  const p = painter(T.kitchenFloor);
  for (let y = 0; y < 2; y++)
    for (let x = 0; x < 2; x++) p.rect(x * 16, y * 16, 16, 16, (x + y) % 2 ? "#e5e7eb" : "#9ca3af");
}
{
  const p = painter(T.rug);
  p.rect(0, 0, 32, 32, "#b45f3c");
  p.rect(0, 0, 32, 2, "#8f4a2e");
  for (let i = 4; i < 32; i += 8) {
    p.rect(i, 10, 4, 4, "#e2b07a");
    p.rect(i, 22, 4, 4, "#e2b07a");
  }
}
{
  const p = painter(T.tileFloor);
  p.rect(0, 0, 32, 32, "#d9d4c7");
  p.rect(0, 0, 32, 1, "#c4bdab");
  p.rect(0, 0, 1, 32, "#c4bdab");
  p.rect(16, 0, 1, 32, "#c4bdab");
  p.rect(0, 16, 32, 1, "#c4bdab");
}
// Parede: topo claro (face superior) e face escura com tijolos.
{
  const p = painter(T.wall);
  p.rect(0, 0, 32, 32, "#3b3f58");
  p.rect(0, 0, 32, 8, "#6b7096");
  p.rect(0, 8, 32, 1, "#2a2d40");
  for (let y = 12; y < 32; y += 6) {
    p.rect(0, y, 32, 1, "#33364c");
    const off = (y / 6) % 2 ? 0 : 8;
    for (let x = off; x < 32; x += 16) p.rect(x, y, 1, 6, "#33364c");
  }
}
// Móveis
{
  const p = painter(T.meetingTable);
  p.box(0, 4, 32, 24, "#7a4e2d");
  p.rect(1, 5, 30, 3, "#93613a");
}
{
  const p = painter(T.diningTable);
  p.box(0, 4, 32, 24, "#d9b38c");
  p.rect(1, 5, 30, 3, "#e8c9a6");
  p.circle(16, 16, 4, "#f8fafc");
  p.circle(16, 16, 2, "#ef4444");
}
const counterTop = (p) => {
  p.box(0, 0, 32, 32, "#9aa3b2");
  p.rect(1, 1, 30, 10, "#cbd5e1");
  p.rect(1, 11, 30, 1, "#64748b");
};
{
  const p = painter(T.counter);
  counterTop(p);
  p.rect(14, 18, 4, 2, "#475569");
}
{
  const p = painter(T.sink);
  counterTop(p);
  p.box(6, 2, 20, 8, "#94a3b8");
  p.rect(15, 1, 2, 3, "#475569");
}
{
  const p = painter(T.stove);
  counterTop(p);
  p.rect(1, 1, 30, 10, "#334155");
  for (const x of [8, 22]) p.circle(x, 6, 3, "#0f172a"), p.circle(x, 6, 1, "#f97316");
  p.box(6, 15, 20, 12, "#1e293b");
}
{
  const p = painter(T.fridge);
  p.box(2, 0, 28, 32, "#f1f5f9");
  p.rect(3, 12, 26, 1, "#94a3b8");
  p.rect(24, 4, 2, 6, "#94a3b8");
  p.rect(24, 16, 2, 10, "#94a3b8");
}
{
  const p = painter(T.coffeeMachine);
  counterTop(p);
  p.box(8, 0, 16, 14, "#111827");
  p.rect(10, 2, 12, 3, "#ef4444");
  p.box(13, 9, 6, 5, "#f8fafc");
  p.rect(14, 10, 4, 2, "#6b3f1d");
}
{
  const p = painter(T.sofaBackTop);
  p.box(0, 2, 32, 28, "#2f6f73");
  p.rect(1, 3, 30, 8, "#24575a");
  p.rect(15, 12, 1, 17, "#24575a");
}
{
  const p = painter(T.sofaBackBottom);
  p.box(0, 2, 32, 28, "#2f6f73");
  p.rect(1, 21, 30, 8, "#24575a");
  p.rect(15, 3, 1, 17, "#24575a");
}
{
  const p = painter(T.coffeeTable);
  p.circle(16, 16, 11, "#1f2433");
  p.circle(16, 16, 10, "#8b5e3c");
  p.circle(12, 13, 2, "#f8fafc");
  p.circle(20, 18, 2, "#fbbf24");
}
{
  const p = painter(T.plant);
  p.box(10, 20, 12, 11, "#b45309");
  p.rect(11, 21, 10, 2, "#92400e");
  p.circle(16, 12, 9, "#14532d");
  p.circle(16, 11, 8, "#16a34a");
  p.circle(11, 9, 3, "#22c55e");
  p.circle(20, 13, 3, "#22c55e");
}
{
  const p = painter(T.bookshelf);
  p.box(0, 0, 32, 32, "#6b4423");
  for (const y of [2, 12, 22]) {
    p.rect(1, y + 8, 30, 2, "#4a2f18");
    const colors = ["#ef4444", "#3b82f6", "#eab308", "#22c55e", "#a855f7", "#f97316"];
    for (let i = 0; i < 6; i++) p.rect(3 + i * 4 + (y % 3), y, 3, 8, colors[(i + y) % colors.length]);
  }
}
{
  const p = painter(T.reception);
  p.box(0, 2, 32, 28, "#e5e7eb");
  p.rect(1, 3, 30, 6, "#f8fafc");
  p.rect(1, 20, 30, 3, "#14b8a6");
}
{
  const p = painter(T.whiteboard);
  p.rect(0, 0, 32, 32, "#3b3f58");
  p.rect(0, 0, 32, 8, "#6b7096");
  p.box(2, 10, 28, 18, "#f8fafc", "#94a3b8");
  p.rect(6, 14, 12, 1, "#2563eb");
  p.rect(6, 18, 16, 1, "#2563eb");
  p.rect(6, 22, 8, 1, "#dc2626");
}
{
  // Placa de estacionamento: poste com "P" branco.
  const p = painter(T.parkingSign);
  p.box(14, 18, 4, 14, "#94a3b8");
  p.box(6, 2, 20, 18, "#ec4899");
  p.rect(12, 6, 3, 10, "#f8fafc");
  p.rect(15, 6, 4, 2, "#f8fafc");
  p.rect(15, 10, 4, 2, "#f8fafc");
  p.rect(19, 7, 2, 4, "#f8fafc");
}
// Decoração sem colisão
{
  const p = painter(T.chair);
  p.box(9, 8, 14, 16, "#334155");
  p.rect(10, 9, 12, 4, "#1e293b");
}
{
  const p = painter(T.beanbag);
  p.circle(16, 17, 11, "#1f2433");
  p.circle(16, 17, 10, "#f59e0b");
  p.circle(13, 14, 4, "#fbbf24");
}

function crc32(buf) {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 6, 0, 0, 0], 8); // 8 bits, RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// --- Mapa ---------------------------------------------------------------------

const grid = () => new Array(W * H).fill(0);
const floor = grid();
const walls = grid();
const furniture = grid();
const decor = grid();
const set = (layer, x, y, gid) => (layer[y * W + x] = gid);
const fill = (layer, x0, y0, x1, y1, gid) => {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(layer, x, y, gid);
};
const hline = (y, x0, x1, gaps = []) => {
  for (let x = x0; x <= x1; x++) if (!gaps.includes(x)) set(walls, x, y, T.wall);
};
const vline = (x, y0, y1, gaps = []) => {
  for (let y = y0; y <= y1; y++) if (!gaps.includes(y)) set(walls, x, y, T.wall);
};

// Pisos por área.
fill(floor, 0, 0, W - 1, H - 1, T.wood);
const ROOMS = [
  { id: "sala-atlantico", name: "Sala Atlântico", x0: 25, y0: 1, x1: 35, y1: 9, door: [29, 30] },
  { id: "sala-1-1", name: "Sala 1:1", x0: 37, y0: 1, x1: 41, y1: 9, door: [39] },
  { id: "sala-foco", name: "Sala Foco", x0: 43, y0: 1, x1: 48, y1: 9, door: [45] },
];
for (const r of ROOMS) fill(floor, r.x0, r.y0, r.x1, r.y1, T.carpet);
const CAFE = { x0: 32, y0: 11, x1: 48, y1: 19 };
fill(floor, CAFE.x0, CAFE.y0, CAFE.x1, CAFE.y1, T.tileFloor);
fill(floor, 35, 13, 45, 18, T.rug);
const KITCHEN = { x0: 32, y0: 21, x1: 48, y1: 30 };
fill(floor, KITCHEN.x0, KITCHEN.y0, KITCHEN.x1, KITCHEN.y1, T.kitchenFloor);

// Paredes: contorno, salas (portas na parede de baixo), cozinha.
hline(0, 0, W - 1);
hline(H - 1, 0, W - 1);
vline(0, 0, H - 1);
vline(W - 1, 0, H - 1);
vline(24, 1, 10);
vline(36, 1, 10);
vline(42, 1, 10);
hline(10, 24, W - 1, ROOMS.flatMap((r) => r.door));
hline(20, 31, W - 1, [38, 39]);
vline(31, 20, H - 1, [25, 26]);

// Lousas nas paredes de cima das salas.
for (const x of [29, 30, 31]) set(walls, x, 0, T.whiteboard);
set(walls, 39, 0, T.whiteboard);
set(walls, 45, 0, T.whiteboard);

// Sala Atlântico: mesa longa com cadeiras.
fill(furniture, 27, 4, 33, 5, T.meetingTable);
for (let x = 27; x <= 33; x++) {
  set(decor, x, 3, T.chair);
  set(decor, x, 6, T.chair);
}
set(furniture, 25, 1, T.plant);
set(furniture, 35, 1, T.plant);
// Sala 1:1: mesinha e duas cadeiras.
fill(furniture, 39, 4, 39, 5, T.meetingTable);
set(decor, 38, 4, T.chair);
set(decor, 40, 5, T.chair);
set(furniture, 41, 1, T.plant);
// Sala Foco: sofá e estante.
fill(furniture, 44, 2, 47, 2, T.sofaBackTop);
set(furniture, 45, 4, T.coffeeTable);
set(furniture, 48, 1, T.bookshelf);
set(furniture, 48, 2, T.bookshelf);

// Recepção: balcão, plantas, estante, sofá de espera.
fill(furniture, 4, 2, 8, 2, T.reception);
set(decor, 6, 1, T.chair);
for (const [x, y] of [[1, 1], [12, 1], [23, 1], [1, 9]]) set(furniture, x, y, T.plant);
for (const x of [18, 19, 20]) set(furniture, x, 1, T.bookshelf);
fill(furniture, 15, 7, 17, 7, T.sofaBackBottom);

// Café / descanso: máquina de café no balcão, sofás, mesinhas, puffs.
// (x 39 e 45 ficam livres: são as saídas da Sala 1:1 e da Sala Foco)
set(furniture, 40, 11, T.counter);
set(furniture, 41, 11, T.coffeeMachine);
set(furniture, 42, 11, T.coffeeMachine);
set(furniture, 43, 11, T.counter);
fill(furniture, 36, 13, 39, 13, T.sofaBackTop);
fill(furniture, 36, 18, 39, 18, T.sofaBackBottom);
set(furniture, 37, 15, T.coffeeTable);
set(furniture, 38, 16, T.coffeeTable);
for (const [x, y] of [[42, 15], [44, 15], [43, 17]]) set(decor, x, y, T.beanbag);
for (const [x, y] of [[32, 11], [48, 19], [32, 19]]) set(furniture, x, y, T.plant);
set(furniture, 48, 11, T.bookshelf);

// Cozinha: bancada com pia/fogão, geladeira, mesa de refeição.
set(furniture, 32, 21, T.fridge);
set(furniture, 33, 21, T.fridge);
fill(furniture, 34, 21, 37, 21, T.counter);
set(furniture, 40, 21, T.sink);
set(furniture, 41, 21, T.counter);
set(furniture, 42, 21, T.stove);
fill(furniture, 43, 21, 47, 21, T.counter);
set(furniture, 46, 21, T.coffeeMachine);
fill(furniture, 38, 25, 43, 26, T.diningTable);
for (let x = 38; x <= 43; x++) {
  set(decor, x, 24, T.chair);
  set(decor, x, 27, T.chair);
}
set(furniture, 48, 30, T.plant);
set(furniture, 32, 30, T.plant);

// Área de trabalho: plantas e estantes nas bordas (as mesas são objetos).
for (const [x, y] of [[1, 12], [1, 30], [29, 12], [29, 30]]) set(furniture, x, y, T.plant);
for (const y of [14, 15, 16]) set(furniture, 1, y, T.bookshelf);

// Garagens: karts na recepção, patinetes na área de trabalho e no café.
const VEHICLE_SPOTS = [
  ["kart", 19, 5], ["kart", 21, 5], ["kart", 19, 7], ["kart", 21, 7],
  ["patinete", 28, 16], ["patinete", 28, 17], ["patinete", 28, 18],
  ["patinete", 47, 15], ["patinete", 47, 16],
];
set(furniture, 23, 4, T.parkingSign);
set(furniture, 29, 15, T.parkingSign);
set(furniture, 47, 13, T.parkingSign);

// --- Mesas de trabalho (objetos) ----------------------------------------------
// Cada mesa ocupa 2×1 tiles; a cadeira fica logo abaixo (quem senta olha para
// cima, para o monitor). 3 fileiras × 6 mesas.
const desks = [];
let deskNo = 1;
for (const row of [13, 19, 25]) {
  for (const col of [4, 8, 12, 16, 20, 24]) {
    desks.push({
      id: 100 + deskNo,
      name: `mesa-${String(deskNo).padStart(2, "0")}`,
      type: "desk",
      x: col * TILE,
      y: row * TILE,
      width: 2 * TILE,
      height: TILE,
      rotation: 0,
      visible: true,
    });
    deskNo++;
  }
}

const tileLayer = (id, name, data) => ({
  id,
  name,
  type: "tilelayer",
  width: W,
  height: H,
  x: 0,
  y: 0,
  opacity: 1,
  visible: true,
  data,
});
const objectLayer = (id, name, objects) => ({
  id,
  name,
  type: "objectgroup",
  draworder: "topdown",
  opacity: 1,
  visible: true,
  x: 0,
  y: 0,
  objects,
});
const area = (id, name, a) => ({
  id,
  name,
  type: "area",
  x: a.x0 * TILE,
  y: a.y0 * TILE,
  width: (a.x1 - a.x0 + 1) * TILE,
  height: (a.y1 - a.y0 + 1) * TILE,
  rotation: 0,
  visible: true,
});

const map = {
  type: "map",
  version: "1.10",
  tiledversion: "1.10.2",
  orientation: "orthogonal",
  renderorder: "right-down",
  infinite: false,
  width: W,
  height: H,
  tilewidth: TILE,
  tileheight: TILE,
  compressionlevel: -1,
  nextlayerid: 10,
  nextobjectid: 400,
  tilesets: [
    {
      firstgid: 1,
      name: "office",
      image: "../tilesets/office-tiles.png",
      imagewidth: TILES * TILE,
      imageheight: TILE,
      tilewidth: TILE,
      tileheight: TILE,
      tilecount: TILES,
      columns: TILES,
      margin: 0,
      spacing: 0,
    },
  ],
  layers: [
    tileLayer(1, "floor", floor),
    tileLayer(2, "walls", walls),
    tileLayer(3, "furniture", furniture),
    tileLayer(4, "decor", decor),
    objectLayer(
      5,
      "zones",
      ROOMS.map((r, i) => ({
        ...area(1 + i, r.name, r),
        type: "zone",
        properties: [{ name: "zoneId", type: "string", value: r.id }],
      })),
    ),
    objectLayer(6, "areas", [
      area(10, "Recepção", { x0: 1, y0: 1, x1: 23, y1: 9 }),
      area(11, "Área de trabalho", { x0: 1, y0: 11, x1: 30, y1: 30 }),
      area(12, "Café", CAFE),
      area(13, "Cozinha", KITCHEN),
    ]),
    objectLayer(7, "desks", desks),
    objectLayer(
      9,
      "vehicles",
      VEHICLE_SPOTS.map(([name, x, y], i) => ({
        id: 300 + i,
        name,
        type: "vehicle",
        point: true,
        x: x * TILE + TILE / 2,
        y: y * TILE + TILE / 2,
        width: 0,
        height: 0,
        rotation: 0,
        visible: true,
      })),
    ),
    objectLayer(8, "objects", [
      { id: 20, name: "spawn", type: "", point: true, x: 10 * TILE, y: 5 * TILE, width: 0, height: 0, rotation: 0, visible: true },
    ]),
  ],
};

mkdirSync(join(root, "maps"), { recursive: true });
mkdirSync(join(root, "tilesets"), { recursive: true });
writeFileSync(join(root, "tilesets", "office-tiles.png"), png(TILES * TILE, TILE, img));
writeFileSync(join(root, "maps", "office.json"), JSON.stringify(map));
console.log(`ok: mapa ${W}×${H}, ${TILES} tiles, ${desks.length} mesas, ${VEHICLE_SPOTS.length} vagas`);
