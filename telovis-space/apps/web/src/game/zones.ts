import Phaser from "phaser";

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
