"use client";

import { useEffect, useRef } from "react";
import type { AvatarLook, Direction } from "@telovis/protocol";
import {
  AVATAR_SIZE,
  DIR_ORDER,
  drawAvatarSheet,
  FRAMES_PER_DIR,
  SHEET_FRAMES,
} from "@/game/avatar-draw";

const WALK_CYCLE = [1, 0, 2, 0];

/**
 * Desenha o avatar com o mesmo código da cena, ampliado sem suavização.
 * `walking` anima a caminhada a 8 quadros/s, como no jogo.
 */
export default function AvatarPreview({
  look,
  direction,
  scale,
  walking = false,
  label,
}: {
  look: AvatarLook;
  direction: Direction;
  scale: number;
  walking?: boolean;
  label?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const sheet = document.createElement("canvas");
    sheet.width = AVATAR_SIZE * SHEET_FRAMES;
    sheet.height = AVATAR_SIZE;
    drawAvatarSheet(sheet.getContext("2d")!, look);

    const base = DIR_ORDER.indexOf(direction) * FRAMES_PER_DIR;
    const paint = (frame: number) => {
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const sx = (base + frame) * AVATAR_SIZE;
      ctx.drawImage(sheet, sx, 0, AVATAR_SIZE, AVATAR_SIZE, 0, 0, canvas.width, canvas.height);
    };

    paint(0);
    if (!walking || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let step = 0;
    const timer = setInterval(() => paint(WALK_CYCLE[++step % WALK_CYCLE.length]), 125);
    return () => clearInterval(timer);
  }, [look, direction, walking]);

  const px = AVATAR_SIZE * scale;
  return (
    <canvas
      ref={canvasRef}
      width={px}
      height={px}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}
