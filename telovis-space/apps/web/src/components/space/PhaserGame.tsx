"use client";

// Este módulo importa o Phaser no topo, e o Phaser acessa `window` ao ser
// avaliado. Por isso ele NUNCA deve ser importado estaticamente: o SpaceClient
// o carrega com next/dynamic + ssr:false, o que o mantém fora do render de
// servidor e num chunk separado (o Phaser tem ~1MB).

import { useEffect, useRef } from "react";
import Phaser from "phaser";
import { OfficeScene, type OfficeSceneData } from "@/game/scenes/OfficeScene";

type Props = OfficeSceneData;

export default function PhaserGame(props: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Os callbacks mudam de identidade a cada render do pai; a cena lê sempre a
  // versão mais recente pelo ref, sem recriar o jogo.
  const propsRef = useRef(props);
  useEffect(() => {
    propsRef.current = props;
  });

  const { socket, media, spaceId, mapJsonUrl, tilesetUrl, playerName } = props;

  useEffect(() => {
    const parent = containerRef.current;
    if (!parent) return;

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent,
      backgroundColor: "#1f2433",
      pixelArt: true,
      roundPixels: true,
      physics: {
        default: "arcade",
        arcade: { gravity: { x: 0, y: 0 }, debug: false },
      },
      scale: {
        mode: Phaser.Scale.RESIZE,
        width: "100%",
        height: "100%",
      },
    });

    const data: OfficeSceneData = {
      socket,
      media,
      spaceId,
      playerName,
      mapJsonUrl,
      tilesetUrl,
      onStatus: (s) => propsRef.current.onStatus(s),
      onNearbyChange: (p) => propsRef.current.onNearbyChange(p),
      onZoneChange: (z) => propsRef.current.onZoneChange(z),
    };
    game.scene.add("OfficeScene", OfficeScene, true, data);

    return () => {
      game.destroy(true);
    };
  }, [socket, media, spaceId, mapJsonUrl, tilesetUrl, playerName]);

  return <div ref={containerRef} className="absolute inset-0" />;
}
