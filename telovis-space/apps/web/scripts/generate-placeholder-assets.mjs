// Gera um mapa Tiled (.json) e um tileset (.png) placeholder para o space
// "demo", no mesmo formato que o Tiled exporta. Substitua pelos assets reais
// de pixel art quando existirem — a cena só depende dos nomes das camadas:
//   floor, walls, furniture (tile layers) · zones, objects (object layers)
//
// Uso: node scripts/generate-placeholder-assets.mjs

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "assets");
const TILE = 32;
const W = 40;
const H = 25;

// --- Tileset: 4 tiles lado a lado --------------------------------------------
// 1 piso · 2 parede · 3 mesa · 4 piso da sala de reunião

const TILES = 4;
const img = Buffer.alloc(TILES * TILE * TILE * 4);

function px(tile, x, y, [r, g, b, a = 255]) {
  const i = (y * TILES * TILE + tile * TILE + x) * 4;
  img[i] = r;
  img[i + 1] = g;
  img[i + 2] = b;
  img[i + 3] = a;
}

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

for (let y = 0; y < TILE; y++) {
  for (let x = 0; x < TILE; x++) {
    const edge = x === 0 || y === 0;
    px(0, x, y, hex(edge ? "#d6cdb8" : "#e8e1d0"));
    px(1, x, y, hex(y < 6 ? "#5a5f86" : (x + y) % 8 === 0 ? "#34384f" : "#3b3f58"));
    const inDesk = x >= 2 && x < TILE - 2 && y >= 4 && y < TILE - 4;
    px(2, x, y, inDesk ? hex(y < 8 ? "#a87449" : "#8b5e3c") : [0, 0, 0, 0]);
    px(3, x, y, hex(edge ? "#b5c4dc" : "#c9d6ea"));
  }
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
const floor = grid().fill(1);
const walls = grid();
const furniture = grid();
const set = (layer, x, y, gid) => (layer[y * W + x] = gid);

// Sala de reunião no canto superior direito, porta na parede de baixo.
const ROOM = { x0: 26, y0: 1, x1: 38, y1: 8 };
for (let y = ROOM.y0; y <= ROOM.y1; y++)
  for (let x = ROOM.x0 + 1; x <= ROOM.x1; x++) set(floor, x, y, 4);

for (let x = 0; x < W; x++) {
  set(walls, x, 0, 2);
  set(walls, x, H - 1, 2);
}
for (let y = 0; y < H; y++) {
  set(walls, 0, y, 2);
  set(walls, W - 1, y, 2);
}
for (let y = ROOM.y0; y <= ROOM.y1 + 1; y++) set(walls, ROOM.x0, y, 2);
for (let x = ROOM.x0; x <= ROOM.x1; x++) {
  if (x === 31 || x === 32) continue; // porta
  set(walls, x, ROOM.y1 + 1, 2);
}

// Mesa de reunião e ilhas de trabalho.
for (let x = 30; x <= 34; x++) for (let y = 4; y <= 5; y++) set(furniture, x, y, 3);
for (const x0 of [4, 11, 18]) {
  for (const y0 of [13, 18]) {
    for (let x = x0; x < x0 + 4; x++) for (let y = y0; y < y0 + 2; y++) set(furniture, x, y, 3);
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
  nextlayerid: 6,
  nextobjectid: 3,
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
    {
      id: 4,
      name: "zones",
      type: "objectgroup",
      draworder: "topdown",
      opacity: 1,
      visible: true,
      x: 0,
      y: 0,
      objects: [
        {
          id: 1,
          name: "Sala de Reunião",
          type: "zone",
          x: (ROOM.x0 + 1) * TILE,
          y: ROOM.y0 * TILE,
          width: (ROOM.x1 - ROOM.x0) * TILE,
          height: (ROOM.y1 - ROOM.y0 + 1) * TILE,
          rotation: 0,
          visible: true,
          properties: [{ name: "zoneId", type: "string", value: "sala-reuniao" }],
        },
      ],
    },
    {
      id: 5,
      name: "objects",
      type: "objectgroup",
      draworder: "topdown",
      opacity: 1,
      visible: true,
      x: 0,
      y: 0,
      objects: [
        { id: 2, name: "spawn", type: "", point: true, x: 8 * TILE, y: 7 * TILE, width: 0, height: 0, rotation: 0, visible: true },
      ],
    },
  ],
};

mkdirSync(join(root, "maps"), { recursive: true });
mkdirSync(join(root, "tilesets"), { recursive: true });
writeFileSync(join(root, "tilesets", "office-tiles.png"), png(TILES * TILE, TILE, img));
writeFileSync(join(root, "maps", "office.json"), JSON.stringify(map));
console.log("Assets placeholder gerados em", root);
