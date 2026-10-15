import type Phaser from "phaser";
import type { AvatarLook, Direction } from "@telovis/protocol";
import {
  AVATAR_SIZE,
  avatarKey,
  DIR_ORDER,
  drawAvatarSheet,
  FRAMES_PER_DIR,
  SHEET_FRAMES,
  SIT_BASE,
} from "./avatar-draw";

// Ponte entre o desenho (avatar-draw.ts) e o Phaser: um spritesheet por
// combinação de visual, gerado em runtime. Quando houver spritesheets reais,
// basta trocar ensureAvatar() por um load.spritesheet() com o mesmo layout.

export { AVATAR_SIZE };

export function idleFrame(direction: Direction): number {
  return DIR_ORDER.indexOf(direction) * FRAMES_PER_DIR;
}

export function sitFrame(direction: Direction): number {
  return SIT_BASE + DIR_ORDER.indexOf(direction);
}

export function walkAnimKey(textureKey: string, direction: Direction): string {
  return `${textureKey}-walk-${direction}`;
}

/** Gera (uma vez) o spritesheet e as animações de caminhada do visual. */
export function ensureAvatar(scene: Phaser.Scene, look: AvatarLook): string {
  const key = avatarKey(look);
  if (scene.textures.exists(key)) return key;

  const tex = scene.textures.createCanvas(key, AVATAR_SIZE * SHEET_FRAMES, AVATAR_SIZE);
  if (!tex) throw new Error("Falha ao criar a textura do avatar");
  drawAvatarSheet(tex.getContext(), look);
  tex.refresh();
  for (let i = 0; i < SHEET_FRAMES; i++) {
    tex.add(i, 0, i * AVATAR_SIZE, 0, AVATAR_SIZE, AVATAR_SIZE);
  }

  DIR_ORDER.forEach((dir, d) => {
    const base = d * FRAMES_PER_DIR;
    scene.anims.create({
      key: walkAnimKey(key, dir),
      frames: [1, 0, 2, 0].map((f) => ({ key, frame: base + f })),
      frameRate: 8,
      repeat: -1,
    });
  });

  return key;
}
