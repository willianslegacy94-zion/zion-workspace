// Veículos de passeio: kart e patinete. Ficam em pontos de garagem no mapa
// (camada `vehicles` do Tiled); qualquer um pega, anda mais rápido e desce
// onde quiser. Não há estoque: a garagem nunca esvazia.

export const VEHICLES = ["kart", "patinete"] as const;
export type Vehicle = (typeof VEHICLES)[number];

export const VEHICLE_NAMES: Record<Vehicle, string> = {
  kart: "Kart",
  patinete: "Patinete",
};

export function isVehicle(v: unknown): v is Vehicle {
  return typeof v === "string" && (VEHICLES as readonly string[]).includes(v);
}
