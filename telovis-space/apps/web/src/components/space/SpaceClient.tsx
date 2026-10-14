"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import type { AvatarLook, DeskState } from "@telovis/protocol";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import type { DeskFocus, NearbyPeer, SceneStatus, ZoneInfo } from "@/game/scenes/OfficeScene";
import { claimDesk } from "@/app/space/desk-actions";
import { createSpaceSocket, type SpaceSocket } from "@/lib/space/socket";
import { MediaController, type MediaState } from "@/lib/media/media-controller";
import ChatPanel from "./ChatPanel";
import DeskSetupDialog from "./DeskSetupDialog";

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
  userId: string;
  playerName: string;
  avatar: AvatarLook;
  /** Mesas com dono quando a página carregou. */
  desks: DeskState[];
  /** null = pode pegar mesa; senão, o motivo (demo, convidado). */
  deskBlockedReason: string | null;
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
  const [area, setArea] = useState<string | null>(null);
  const [desk, setDesk] = useState<DeskFocus | null>(null);
  const [editingDesk, setEditingDesk] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [claiming, startClaim] = useTransition();

  const showNotice = useCallback((message: string) => setNotice(message), []);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4_000);
    return () => clearTimeout(t);
  }, [notice]);

  // Ação da tecla E / do botão: pegar a mesa livre ou abrir o setup da sua.
  const deskAction = useCallback(() => {
    if (!desk || claiming) return;
    if (desk.mine) {
      setEditingDesk(true);
      return;
    }
    if (desk.owner) return;
    if (props.deskBlockedReason) {
      showNotice(props.deskBlockedReason);
      return;
    }
    startClaim(async () => {
      const res = await claimDesk(props.spaceId, desk.key);
      if (!res.ok) showNotice(res.error);
      // A cena atualiza pelo `desk:updated`; já abre o setup da mesa nova.
      else setEditingDesk(true);
    });
  }, [desk, claiming, props.deskBlockedReason, props.spaceId, showNotice]);

  // Longe de qualquer mesa não há o que editar (ex.: pegou a mesa mas o
  // aviso do realtime não chegou e a pessoa saiu andando).
  useEffect(() => {
    if (!desk) setEditingDesk(false);
  }, [desk]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "e" && e.key !== "E") return;
      if (e.repeat || editingDesk || isTextInput(document.activeElement)) return;
      deskAction();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deskAction, editingDesk]);

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
          userId={props.userId}
          playerName={props.playerName}
          avatar={props.avatar}
          desks={props.desks}
          mapJsonUrl={props.mapJsonUrl}
          tilesetUrl={props.tilesetUrl}
          onStatus={setStatus}
          onNearbyChange={setNearby}
          onZoneChange={setZone}
          onAreaChange={setArea}
          onDeskFocus={setDesk}
        />
      )}

      {/* O minimapa é uma câmera do Phaser, desenhada no canto superior
          esquerdo do canvas, logo abaixo deste cabeçalho. */}
      <header className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-2 p-3">
        <div className="pointer-events-auto rounded-lg bg-black/60 px-3 py-2 text-sm backdrop-blur">
          <span className="font-semibold">{props.spaceName}</span>
          {(zone?.name ?? area) && <span className="ml-2 text-slate-300">· {zone?.name ?? area}</span>}
          <span className="ml-2 text-slate-400">
            {STATUS_LABEL[status.kind]}
            {status.kind === "error" && ` — ${status.message}`}
            {status.kind === "joined" && !status.media && " (sem mídia: LiveKit não configurado)"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden rounded-lg bg-black/60 px-3 py-2 text-xs text-slate-400 backdrop-blur sm:block">
            WASD / setas para andar · Enter para conversar
          </div>
          <Link
            href={`/space/${props.spaceId}/customizer`}
            className="pointer-events-auto rounded-lg bg-black/60 px-3 py-2 text-sm backdrop-blur hover:bg-black/80"
          >
            Avatar
          </Link>
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

      {(desk || notice) && (
        <div className="pointer-events-none absolute inset-x-0 bottom-24 flex flex-col items-center gap-2">
          {notice && (
            <div role="status" className="rounded-lg bg-amber-500/90 px-4 py-2 text-sm font-medium text-black shadow-lg">
              {notice}
            </div>
          )}
          {desk && !editingDesk && <DeskPrompt desk={desk} busy={claiming} onAction={deskAction} />}
        </div>
      )}

      {editingDesk && desk?.mine && (
        <DeskSetupDialog
          key={desk.key}
          spaceId={props.spaceId}
          initial={desk.setup}
          onClose={() => setEditingDesk(false)}
          onError={showNotice}
        />
      )}

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

function DeskPrompt({ desk, busy, onAction }: { desk: DeskFocus; busy: boolean; onAction: () => void }) {
  const kbd = <kbd className="rounded bg-white/20 px-1.5 py-0.5 font-mono text-xs">E</kbd>;
  let text: React.ReactNode;
  let actionable = true;
  if (desk.mine) text = <>Sua mesa · {kbd} montar setup</>;
  else if (desk.owner) {
    text = <>Mesa de {desk.owner.name}</>;
    actionable = false;
  } else text = <>Mesa livre · {kbd} pegar esta mesa</>;

  return (
    <button
      type="button"
      disabled={!actionable || busy}
      onClick={onAction}
      className="pointer-events-auto rounded-full bg-black/75 px-4 py-2 text-sm text-slate-100 shadow-lg backdrop-blur enabled:hover:bg-black/90 disabled:cursor-default"
    >
      {busy ? "Pegando a mesa…" : text}
    </button>
  );
}

function isTextInput(el: Element | null): boolean {
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    (el instanceof HTMLElement && el.isContentEditable)
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
