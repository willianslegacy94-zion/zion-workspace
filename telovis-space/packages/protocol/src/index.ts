// Contrato de eventos Socket.io entre o cliente (Phaser) e o servidor realtime.
// Fonte única dos tipos — importado por apps/web e apps/realtime.
//
// Diferença deliberada em relação à spec (seção 3.1): o cliente NÃO envia `id`
// nem `roomId` no `player:move`. O servidor deriva os dois do próprio socket
// (socket.id e a sala em que ele entrou via `room:join`), então um cliente não
// consegue mover o avatar de outra pessoa nem publicar em outra sala.

import type { AvatarLook } from "./avatar";
import type { DeskState } from "./desk";
import type { Vehicle } from "./vehicle";
import type { AwayStatus } from "./presence";

export * from "./avatar";
export * from "./desk";
export * from "./vehicle";
export * from "./presence";

export type Direction = "up" | "down" | "left" | "right";

export const DIRECTIONS: readonly Direction[] = ["up", "down", "left", "right"];

export interface PlayerState {
  /** socket.id — uma pessoa com duas abas abertas vira dois avatares. */
  id: string;
  /** id do User dono do avatar. */
  userId: string;
  name: string;
  avatar: AvatarLook;
  x: number;
  y: number;
  direction: Direction;
  moving: boolean;
  /** Zona privada do Tiled em que o avatar está, ou null fora de zonas. */
  zoneId: string | null;
  /** Veículo em que está andando, ou null a pé. */
  vehicle: Vehicle | null;
  /** Sentado numa cadeira (pose parada, virado para a mesa). */
  sitting: boolean;
  /** Ausência ("Almoço", "Volto já"…), ou null quando disponível. */
  status: AwayStatus | null;
}

export type PlayerMove = Pick<
  PlayerState,
  "id" | "x" | "y" | "direction" | "moving" | "zoneId" | "vehicle" | "sitting"
>;

/**
 * O nome exibido e o space permitido vêm do ticket do handshake (ver
 * `RealtimeTicketClaims`), não deste payload: o cliente só diz onde nasce.
 */
export interface JoinPayload {
  spaceId: string;
  x: number;
  y: number;
}

/**
 * Claims do ticket que o Next emite (após checar sessão + SpaceMember) e o
 * cliente apresenta no handshake do Socket.io em `auth.token`. JWT HS256 com
 * segredo compartilhado `REALTIME_TICKET_SECRET`; vida curta, só para conectar.
 */
export interface RealtimeTicketClaims {
  /** id do User */
  sub: string;
  name: string;
  /** slug do space que o ticket libera */
  space: string;
  role: SpaceRole;
  /** Visual salvo no Customizer (ou o padrão derivado do nome). */
  avatar: AvatarLook;
}

export type SpaceRole = "ADMIN" | "MEMBER" | "GUEST";

export const REALTIME_TICKET_AUDIENCE = "telovis-realtime";

/**
 * Eventos que o Next manda ao realtime (POST /internal/events) quando algo
 * muda no banco e precisa valer para quem já está conectado. Autenticados por
 * JWT HS256 com o mesmo segredo do ticket, mas outra audiência.
 */
export const REALTIME_INTERNAL_AUDIENCE = "telovis-realtime-internal";

export type RealtimeInternalEvent =
  | { type: "member.removed"; userId: string; space: string }
  | { type: "member.role"; userId: string; space: string; role: SpaceRole }
  | { type: "avatar.updated"; userId: string; avatar: AvatarLook }
  | { type: "desk.updated"; space: string; desk: DeskState };

export interface LivekitCredentials {
  url: string;
  token: string;
}

export type JoinAck =
  | {
      ok: true;
      selfId: string;
      players: PlayerState[];
      /** null quando o servidor está sem LiveKit configurado (só posição). */
      livekit: LivekitCredentials | null;
    }
  | { ok: false; error: string };

export type MovePayload = Omit<PlayerMove, "id">;

export const CHAT_MAX_LENGTH = 300;

export interface ChatMessage {
  id: string;
  playerId: string;
  name: string;
  text: string;
  at: number;
}

export type ChatAck =
  | { ok: true; /** quantos colegas receberam (sem contar o remetente) */ delivered: number }
  | { ok: false; error: string };

export interface ClientToServerEvents {
  "room:join": (payload: JoinPayload, ack: (res: JoinAck) => void) => void;
  "player:move": (payload: MovePayload) => void;
  "chat:send": (payload: { text: string }, ack: (res: ChatAck) => void) => void;
  "status:set": (payload: { status: AwayStatus | null }) => void;
}

export interface ServerToClientEvents {
  "player:joined": (player: PlayerState) => void;
  "player:moved": (move: PlayerMove) => void;
  /** Visual trocado no Customizer, com a pessoa já na sala. */
  "player:updated": (update: { id: string; avatar: AvatarLook }) => void;
  "player:left": (playerId: string) => void;
  /** Mudança de ausência; vai também para quem mudou (confirmação). */
  "player:status": (update: { id: string; status: AwayStatus | null }) => void;
  /** Enviado logo antes de o servidor derrubar a conexão (ex.: removido do space). */
  "session:revoked": (reason: string) => void;
  /** Alguém pegou, montou ou liberou uma mesa. */
  "desk:updated": (desk: DeskState) => void;
  /** Entregue só a quem está no alcance do remetente — e ao próprio remetente. */
  "chat:message": (message: ChatMessage) => void;
}

/** Raio de áudio/vídeo e de chat (spec, seção 3.2). */
export const EARSHOT_RADIUS = 150;

type Earshot = { x: number; y: number; zoneId: string | null };

/**
 * Regra de alcance sem histerese, usada pelo servidor para decidir quem recebe
 * uma mensagem de chat. Mesma regra da mídia: se algum dos dois está em zona
 * privada, só vale estar na mesma zona; fora de zonas, vale o raio.
 */
export function canHear(a: Earshot, b: Earshot): boolean {
  if (a.zoneId !== null || b.zoneId !== null) return a.zoneId === b.zoneId;
  return Math.hypot(b.x - a.x, b.y - a.y) <= EARSHOT_RADIUS;
}

/** Nome da sala LiveKit de um space — o servidor emite o token para ela. */
export function livekitRoomName(spaceId: string): string {
  return `space:${spaceId}`;
}

export const SPACE_ID_PATTERN = /^[a-z0-9-]{1,64}$/;
