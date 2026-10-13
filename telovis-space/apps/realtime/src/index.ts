import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { Server, type Socket } from "socket.io";
import {
  canHear,
  type ClientToServerEvents,
  type LivekitCredentials,
  type PlayerState,
  type RealtimeTicketClaims,
  type ServerToClientEvents,
} from "@telovis/protocol";
import { RoomRegistry } from "./rooms.js";
import { parseChat, parseJoin, parseMove } from "./validation.js";
import { createLivekitCredentials } from "./livekit.js";
import { loadTicketSecret, verifyTicket } from "./auth.js";

interface SocketData {
  /** Preenchido pelo io.use(): quem é e em qual space pode entrar. */
  user: RealtimeTicketClaims;
  spaceId?: string;
  lastMoveAt: number;
  lastChatAt: number;
}

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>;

const PORT = Number(process.env.PORT ?? 4000);
const CORS_ORIGIN = (process.env.CORS_ORIGIN ?? "http://localhost:3000")
  .split(",")
  .map((o) => o.trim());

// Teto de mensagens de movimento por socket. O cliente envia a ~15Hz; acima de
// ~30Hz é cliente com bug ou abusivo, e o excesso é descartado sem aviso.
const MIN_MOVE_INTERVAL_MS = 33;
const MIN_CHAT_INTERVAL_MS = 500;

const TICKET_SECRET = loadTicketSecret();

const rooms = new RoomRegistry();

const httpServer = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, ...rooms.stats() }));
    return;
  }
  res.writeHead(404).end();
});

const io = new Server<ClientToServerEvents, ServerToClientEvents, {}, SocketData>(
  httpServer,
  { cors: { origin: CORS_ORIGIN } },
);

// Só conecta quem traz um ticket válido, emitido pelo Next depois de checar a
// sessão e o vínculo SpaceMember. O erro chega ao cliente em `connect_error`.
io.use(async (socket, next) => {
  const user = await verifyTicket(socket.handshake.auth?.token, TICKET_SECRET);
  if (!user) {
    next(new Error("não autorizado"));
    return;
  }
  socket.data.user = user;
  next();
});

function leaveCurrentRoom(socket: AppSocket) {
  const { spaceId } = socket.data;
  if (!spaceId) return;
  rooms.leave(spaceId, socket.id);
  socket.leave(spaceId);
  socket.to(spaceId).emit("player:left", socket.id);
  socket.data.spaceId = undefined;
}

io.on("connection", (socket) => {
  socket.data.lastMoveAt = 0;
  socket.data.lastChatAt = 0;

  socket.on("room:join", async (raw, ack) => {
    if (typeof ack !== "function") return;
    const payload = parseJoin(raw);
    if (!payload) {
      ack({ ok: false, error: "payload inválido" });
      return;
    }
    const { user } = socket.data;
    if (payload.spaceId !== user.space) {
      ack({ ok: false, error: "sem acesso a este space" });
      return;
    }

    leaveCurrentRoom(socket);

    const player: PlayerState = {
      id: socket.id,
      userId: user.sub,
      name: user.name,
      avatar: user.avatar,
      x: Math.round(payload.x),
      y: Math.round(payload.y),
      direction: "down",
      moving: false,
      zoneId: null,
    };

    let livekit: LivekitCredentials | null = null;
    try {
      livekit = await createLivekitCredentials(socket.id, player.name, payload.spaceId);
    } catch (err) {
      console.error("[livekit] falha ao gerar token", err);
    }
    // O socket pode ter caído enquanto o token era gerado.
    if (socket.disconnected) return;

    const others = rooms.join(payload.spaceId, player);
    socket.data.spaceId = payload.spaceId;
    socket.join(payload.spaceId);
    socket.to(payload.spaceId).emit("player:joined", player);

    ack({ ok: true, selfId: socket.id, players: others, livekit });
  });

  socket.on("player:move", (raw) => {
    const { spaceId } = socket.data;
    if (!spaceId) return;

    const payload = parseMove(raw);
    if (!payload) return;

    // A parada sempre passa: carrega a posição final do avatar.
    const now = Date.now();
    if (payload.moving && now - socket.data.lastMoveAt < MIN_MOVE_INTERVAL_MS) return;
    socket.data.lastMoveAt = now;

    const move = { id: socket.id, ...payload };
    if (!rooms.move(spaceId, move)) return;

    // Posição em movimento é descartável (a próxima corrige), então vai como
    // volatile. A parada (moving=false) precisa chegar, então vai confiável.
    const target = socket.to(spaceId);
    if (move.moving) target.volatile.emit("player:moved", move);
    else target.emit("player:moved", move);
  });

  socket.on("chat:send", (raw, ack) => {
    if (typeof ack !== "function") return;
    const { spaceId } = socket.data;
    const sender = spaceId ? rooms.get(spaceId, socket.id) : undefined;
    if (!spaceId || !sender) {
      ack({ ok: false, error: "fora da sala" });
      return;
    }

    const text = parseChat(raw);
    if (!text) {
      ack({ ok: false, error: "mensagem inválida" });
      return;
    }

    const now = Date.now();
    if (now - socket.data.lastChatAt < MIN_CHAT_INTERVAL_MS) {
      ack({ ok: false, error: "devagar — aguarde um instante" });
      return;
    }
    socket.data.lastChatAt = now;

    // Chat por proximidade: o servidor conhece as posições e as zonas, então
    // filtra os destinatários aqui — quem está longe nem recebe o pacote.
    const recipients: string[] = [];
    for (const player of rooms.players(spaceId)) {
      if (player.id !== sender.id && canHear(sender, player)) recipients.push(player.id);
    }

    const message = { id: randomUUID(), playerId: sender.id, name: sender.name, text, at: now };
    io.to([...recipients, sender.id]).emit("chat:message", message);
    ack({ ok: true, delivered: recipients.length });
  });

  socket.on("disconnect", () => leaveCurrentRoom(socket));
});

httpServer.listen(PORT, () => {
  console.log(`[realtime] ouvindo em :${PORT} (CORS: ${CORS_ORIGIN.join(", ")})`);
});

function shutdown() {
  io.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5_000).unref();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
