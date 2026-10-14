import Phaser from "phaser";
import { isVehicle, type Vehicle } from "@telovis/protocol";

export interface PrivateZone {
  id: string;
  /** Nome exibido (nome do objeto no Tiled). */
  name: string;
  bounds: Phaser.Geom.Rectangle;
}

/**
 * Lê as zonas privadas da camada de objetos `zones` do Tiled. Cada retângulo
 * vira uma zona; o id vem da propriedade customizada `zoneId` ou, na falta
 * dela, do nome do objeto.
 */
export function parseZones(map: Phaser.Tilemaps.Tilemap): PrivateZone[] {
  const layer = map.getObjectLayer("zones");
  if (!layer) return [];

  const zones: PrivateZone[] = [];
  for (const obj of layer.objects) {
    if (obj.width === undefined || obj.height === undefined) continue;
    const props = (obj.properties ?? []) as { name: string; value: unknown }[];
    const prop = props.find((p) => p.name === "zoneId")?.value;
    const id = typeof prop === "string" && prop ? prop : obj.name;
    if (!id) continue;
    zones.push({
      id,
      name: obj.name || id,
      bounds: new Phaser.Geom.Rectangle(obj.x ?? 0, obj.y ?? 0, obj.width, obj.height),
    });
  }
  return zones;
}

export function zoneAt(zones: PrivateZone[], x: number, y: number): PrivateZone | null {
  for (const zone of zones) {
    if (zone.bounds.contains(x, y)) return zone;
  }
  return null;
}

export interface MapArea {
  name: string;
  bounds: Phaser.Geom.Rectangle;
}

/**
 * Áreas abertas com nome (camada `areas`): cozinha, café, área de trabalho.
 * Só rótulo e orientação — o áudio nelas segue a proximidade normal.
 */
export function parseAreas(map: Phaser.Tilemaps.Tilemap): MapArea[] {
  const layer = map.getObjectLayer("areas");
  if (!layer) return [];
  return layer.objects
    .filter((o) => o.name && o.width !== undefined && o.height !== undefined)
    .map((o) => ({
      name: o.name,
      bounds: new Phaser.Geom.Rectangle(o.x ?? 0, o.y ?? 0, o.width!, o.height!),
    }));
}

export function areaAt(areas: MapArea[], x: number, y: number): MapArea | null {
  return areas.find((a) => a.bounds.contains(x, y)) ?? null;
}

export interface DeskSlot {
  key: string;
  x: number;
  y: number;
}

/** Posições de mesa (camada `desks`): o nome do objeto é a chave. */
export function parseDeskSlots(map: Phaser.Tilemaps.Tilemap): DeskSlot[] {
  const layer = map.getObjectLayer("desks");
  if (!layer) return [];
  return layer.objects
    .filter((o) => o.name)
    .map((o) => ({ key: o.name, x: o.x ?? 0, y: o.y ?? 0 }));
}

export interface VehicleStation {
  vehicle: Vehicle;
  x: number;
  y: number;
}

/**
 * Garagens (camada `vehicles`): pontos cujo nome é o veículo ("kart",
 * "patinete"). Nomes desconhecidos são ignorados.
 */
export function parseVehicleStations(map: Phaser.Tilemaps.Tilemap): VehicleStation[] {
  const layer = map.getObjectLayer("vehicles");
  if (!layer) return [];
  return layer.objects.flatMap((o) =>
    isVehicle(o.name) ? [{ vehicle: o.name, x: o.x ?? 0, y: o.y ?? 0 }] : [],
  );
}
