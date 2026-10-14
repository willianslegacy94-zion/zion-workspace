import type Phaser from "phaser";
import type { Vehicle } from "@telovis/protocol";
import {
  drawVehicleSheet,
  VEHICLE_FRAME,
  VEHICLE_SHEET_FRAMES,
  vehicleTextureKey,
} from "./vehicle-draw";

/** Gera (uma vez) o spritesheet do veículo. */
export function ensureVehicle(scene: Phaser.Scene, vehicle: Vehicle): string {
  const key = vehicleTextureKey(vehicle);
  if (scene.textures.exists(key)) return key;

  const tex = scene.textures.createCanvas(key, VEHICLE_FRAME * VEHICLE_SHEET_FRAMES, VEHICLE_FRAME);
  if (!tex) throw new Error("Falha ao criar a textura do veículo");
  drawVehicleSheet(tex.getContext(), vehicle);
  tex.refresh();
  for (let i = 0; i < VEHICLE_SHEET_FRAMES; i++) {
    tex.add(i, 0, i * VEHICLE_FRAME, 0, VEHICLE_FRAME, VEHICLE_FRAME);
  }
  return key;
}
