"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { NearbyPeer, SceneStatus, ZoneInfo } from "@/game/scenes/OfficeScene";
import { createSpaceSocket, type SpaceSocket } from "@/lib/space/socket";
import { MediaController, type MediaState } from "@/lib/media/media-controller";
import ChatPanel from "./ChatPanel";

// ssr:false só é permitido em Client Components — por isso o carregamento do
// Phaser fica aqui e não na page (Server Component).
const PhaserGame = dynamic(() => import("./PhaserGame"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 grid place-items-center text-sm text-slate-400">
      Carregando escritório…
    </div>
  ),
});

interface Props {
  spaceId: string;
  spaceName: string;
  mapJsonUrl: string;
  tilesetUrl: string;
  playerName: string;
}

interface Session {
  socket: SpaceSocket;
  media: MediaController;
}

const STATUS_LABEL: Record<SceneStatus["kind"], string> = {
  connecting: "Conectando…",
  joined: "Online",
  reconnecting: "Reconectando…",
  error: "Erro",
};

export default function SpaceClient(props: Props) {
  const videoRef = useRef<HTMLDivElement>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<SceneStatus>({ kind: "connecting" });
  const [nearby, setNearby] = useState<NearbyPeer[]>([]);
  const [zone, setZone] = useState<ZoneInfo | null>(null);

  // Socket e mídia vivem fora do Phaser: sobrevivem a um remount da cena e
  // são encerrados juntos quando a página sai.
  useEffect(() => {
    const socket = createSpaceSocket(props.spaceId);
    const media = new MediaController(videoRef.current!);
    setSession({ socket, media });
    return () => {
      socket.disconnect();
      void media.disconnect();
      setSession(null);
    };
  }, [props.spaceId]);

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-[#1f2433] text-slate-100">
      {session && (
        <PhaserGame
          socket={session.socket}
          media={session.media}
          spaceId={props.spaceId}
          playerName={props.playerName}
          mapJsonUrl={props.mapJsonUrl}
          tilesetUrl={props.tilesetUrl}
          onStatus={setStatus}
          onNearbyChange={setNearby}
          onZoneChange={setZone}
        />
      )}

      {/* O minimapa é uma câmera do Phaser, desenhada no canto superior
          esquerdo do canvas, logo abaixo deste cabeçalho. */}
      <header className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-2 p-3">
        <div className="pointer-events-auto rounded-lg bg-black/60 px-3 py-2 text-sm backdrop-blur">
          <span className="font-semibold">{props.spaceName}</span>
          <span className="ml-2 text-slate-400">
            {STATUS_LABEL[status.kind]}
            {status.kind === "error" && ` — ${status.message}`}
            {status.kind === "joined" && !status.media && " (sem mídia: LiveKit não configurado)"}
          </span>
        </div>
        <div className="hidden rounded-lg bg-black/60 px-3 py-2 text-xs text-slate-400 backdrop-blur sm:block">
          WASD / setas para andar · Enter para conversar
        </div>
      </header>

      {zone && (
        <div className="pointer-events-none absolute inset-x-0 top-16 flex justify-center">
          <div className="rounded-full bg-blue-500/80 px-4 py-1.5 text-sm font-medium text-white shadow-lg backdrop-blur">
            {zone.name} — conversa privada, só quem está aqui ouve
          </div>
        </div>
      )}

      {/* Vídeos remotos: o MediaController insere os elementos aqui. */}
      <div
        ref={videoRef}
        className="pointer-events-none absolute right-3 top-16 flex flex-col gap-2"
      />

      {session && (
        <footer className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-3 p-3">
          <div className="pointer-events-auto">
            <ChatPanel socket={session.socket} nearby={nearby} />
          </div>
          <div className="pointer-events-auto">
            <MediaControls media={session.media} />
          </div>
        </footer>
      )}
    </main>
  );
}

function MediaControls({ media }: { media: MediaController }) {
  const state = useSyncExternalStore<MediaState>(
    (cb) => media.subscribe(cb),
    () => media.getState(),
    () => media.getState(),
  );

  return (
    <div className="flex gap-2">
      {!state.canPlayAudio && (
        <HudButton onClick={() => media.unlockAudio()} active>
          Ativar áudio
        </HudButton>
      )}
      <HudButton
        disabled={!state.connected}
        active={state.micOn}
        onClick={() => media.setMicrophone(!state.micOn)}
      >
        {state.micOn ? "Mic ligado" : "Mic desligado"}
      </HudButton>
      <HudButton
        disabled={!state.connected}
        active={state.camOn}
        onClick={() => media.setCamera(!state.camOn)}
      >
        {state.camOn ? "Câmera ligada" : "Câmera desligada"}
      </HudButton>
    </div>
  );
}

function HudButton({
  active,
  disabled,
  onClick,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => unknown;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        Promise.resolve(onClick()).catch((err) => console.error("[media]", err));
      }}
      className={`rounded-lg px-3 py-2 text-sm font-medium backdrop-blur transition disabled:opacity-40 ${
        active ? "bg-emerald-500 text-black" : "bg-black/60 text-slate-100 hover:bg-black/80"
      }`}
    >
      {children}
    </button>
  );
}
