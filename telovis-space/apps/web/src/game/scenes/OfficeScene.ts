import Phaser from "phaser";
import {
  EARSHOT_RADIUS,
  type AvatarLook,
  type ChatMessage,
  type Direction,
  type PlayerMove,
  type PlayerState,
} from "@telovis/protocol";
import { UNAUTHORIZED, type SpaceSocket } from "@/lib/space/socket";
import type { MediaController } from "@/lib/media/media-controller";
import {
  decideMedia,
  type DecisionReason,
  type MediaDecisions,
} from "@/lib/proximity/proximity";
import { parseZones, zoneAt, type PrivateZone } from "../zones";
import { AVATAR_SIZE, ensureAvatar, idleFrame, walkAnimKey } from "../avatar";

export type SceneStatus =
  | { kind: "connecting" }
  | { kind: "joined"; media: boolean }
  | { kind: "reconnecting" }
  | { kind: "error"; message: string };

export interface NearbyPeer {
  id: string;
  name: string;
  distance: number;
  reason: DecisionReason;
}

export interface ZoneInfo {
  id: string;
  name: string;
}

export interface OfficeSceneData {
  socket: SpaceSocket;
  media: MediaController;
  spaceId: string;
  playerName: string;
  avatar: AvatarLook;
  mapJsonUrl: string;
  tilesetUrl: string;
  onStatus: (status: SceneStatus) => void;
  onNearbyChange: (peers: NearbyPeer[]) => void;
  onZoneChange: (zone: ZoneInfo | null) => void;
}

const SPEED = 160; // px/s
const MOVE_EMIT_INTERVAL_MS = 66; // ~15Hz; o servidor descarta acima de ~30Hz
const PROXIMITY_INTERVAL_MS = 200; // 5Hz basta para ligar/desligar mídia
const REMOTE_SMOOTHING_MS = 90; // constante de tempo da interpolação remota
const BUBBLE_MS = 6_000;
const MINIMAP_WIDTH = 200;
const MINIMAP_MARGIN = { x: 12, y: 64 }; // abaixo do cabeçalho da HUD

// Camadas de desenho. Avatares usam depth = y (quem está mais embaixo na tela
// fica na frente); decoração de mundo fica abaixo deles, textos acima.
const DEPTH = { zones: 1, radius: 2, ring: 3, overlay: 100_000 } as const;


type MoveKeys = Record<
  "W" | "A" | "S" | "D" | "UP" | "DOWN" | "LEFT" | "RIGHT",
  Phaser.Input.Keyboard.Key
>;

/** Tudo que é desenhado para um jogador (local ou remoto). */
interface AvatarView {
  sprite: Phaser.GameObjects.Sprite;
  textureKey: string;
  label: Phaser.GameObjects.Text;
  /** Ponto no minimapa (o sprite em si some naquela escala). */
  dot: Phaser.GameObjects.Arc;
  bubble: Phaser.GameObjects.Text | null;
  bubbleTimer: Phaser.Time.TimerEvent | null;
}

interface RemoteAvatar extends AvatarView {
  state: PlayerState;
  /** Anel sob o avatar quando a mídia dele está ativa para você. */
  ring: Phaser.GameObjects.Ellipse;
}

interface SentState {
  x: number;
  y: number;
  direction: Direction;
  moving: boolean;
  zoneId: string | null;
}

export class OfficeScene extends Phaser.Scene {
  private ctx!: OfficeSceneData;
  private me!: AvatarView & { sprite: Phaser.Physics.Arcade.Sprite };
  private keys!: MoveKeys;
  private zones: PrivateZone[] = [];
  private zoneHighlights = new Map<string, Phaser.GameObjects.Rectangle>();
  private radius!: Phaser.GameObjects.Arc;
  private minimap!: Phaser.Cameras.Scene2D.Camera;
  private viewportBox!: Phaser.GameObjects.Rectangle;

  private selfId: string | null = null;
  private direction: Direction = "down";
  private currentZone: PrivateZone | null = null;
  private remotes = new Map<string, RemoteAvatar>();

  private lastSent: SentState | null = null;
  private lastEmitAt = 0;
  private lastProximityAt = 0;
  private lastDecisions: MediaDecisions = new Map();
  private lastNearbyKey = "";

  // Em React StrictMode o jogo é criado, destruído e recriado; a destruição
  // do Phaser roda no frame seguinte, então callbacks de rede da instância
  // antiga ainda podem chegar. Esta flag faz eles virarem no-op.
  private disposed = false;

  constructor() {
    super("OfficeScene");
  }

  init(data: OfficeSceneData) {
    this.ctx = data;
  }

  preload() {
    this.load.tilemapTiledJSON("office-map", this.ctx.mapJsonUrl);
    this.load.image("office-tiles", this.ctx.tilesetUrl);
  }

  create() {
    // --- Mapa e colisão -----------------------------------------------------
    const map = this.make.tilemap({ key: "office-map" });
    // O nome do tileset vem do próprio JSON, para aceitar qualquer mapa do Tiled.
    const tileset = map.addTilesetImage(map.tilesets[0].name, "office-tiles");
    if (!tileset) throw new Error("Tileset do mapa não encontrado");

    map.createLayer("floor", tileset);
    const walls = map.createLayer("walls", tileset);
    const furniture = map.createLayer("furniture", tileset);
    // Qualquer tile presente nas camadas de parede/móveis bloqueia passagem.
    walls?.setCollisionByExclusion([-1]);
    furniture?.setCollisionByExclusion([-1]);

    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

    // A câmera do minimapa nasce antes dos objetos para que cada um possa ser
    // marcado como "só na tela principal" ou "só no minimapa" ao ser criado.
    this.createMinimap(map);

    // --- Zonas privadas ------------------------------------------------------
    this.zones = parseZones(map);
    const outlines = this.add.graphics().setDepth(DEPTH.zones);
    for (const zone of this.zones) {
      const { x, y, width, height } = zone.bounds;
      outlines.lineStyle(2, 0x93c5fd, 0.35).strokeRect(x + 1, y + 1, width - 2, height - 2);
      const highlight = this.add
        .rectangle(x, y, width, height, 0x60a5fa, 0.14)
        .setOrigin(0)
        .setDepth(DEPTH.zones)
        .setVisible(false);
      this.zoneHighlights.set(zone.id, highlight);
      const title = this.add
        .text(x + 6, y + 4, zone.name, {
          fontFamily: "monospace",
          fontSize: "10px",
          color: "#dbeafe",
        })
        .setAlpha(0.75)
        .setDepth(DEPTH.zones)
        .setResolution(2);
      this.minimap.ignore(title);
    }

    // --- Jogador local -------------------------------------------------------
    const spawn = map.findObject("objects", (o) => o.name === "spawn");
    const spawnX = (spawn?.x ?? map.widthInPixels / 2) + Phaser.Math.Between(-24, 24);
    const spawnY = (spawn?.y ?? map.heightInPixels / 2) + Phaser.Math.Between(-24, 24);

    const myTexture = ensureAvatar(this, this.ctx.avatar);
    const sprite = this.physics.add.sprite(spawnX, spawnY, myTexture, idleFrame("down"));
    sprite.setCollideWorldBounds(true);
    // Hitbox só nos pés: deixa passar rente a móveis e "atrás" de mesas.
    sprite.setSize(14, 8).setOffset(5, 15);
    if (walls) this.physics.add.collider(sprite, walls);
    if (furniture) this.physics.add.collider(sprite, furniture);

    this.me = {
      ...this.createDecor(this.ctx.playerName, "#bbf7d0", 0x22c55e, spawnX, spawnY),
      sprite,
      textureKey: myTexture,
    };
    this.minimap.ignore(sprite);

    this.radius = this.add
      .circle(spawnX, spawnY, EARSHOT_RADIUS, 0xffffff, 0.035)
      .setStrokeStyle(1, 0xffffff, 0.22)
      .setDepth(DEPTH.radius);
    this.minimap.ignore(this.radius);

    const camera = this.cameras.main;
    camera.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    camera.startFollow(sprite, true, 0.15, 0.15);
    camera.setZoom(1.5);

    // enableCapture=false: o Phaser não chama preventDefault em W/A/S/D/setas,
    // então inputs HTML (chat) continuam digitáveis. O movimento em si é
    // bloqueado enquanto um input tem foco — ver isTyping().
    this.keys = this.input.keyboard!.addKeys(
      "W,A,S,D,UP,DOWN,LEFT,RIGHT",
      false,
    ) as MoveKeys;

    // --- Rede ----------------------------------------------------------------
    const { socket } = this.ctx;
    socket.on("connect", this.join);
    socket.on("disconnect", this.onDisconnect);
    socket.on("connect_error", this.onConnectError);
    socket.on("player:joined", this.onPlayerJoined);
    socket.on("player:moved", this.onPlayerMoved);
    socket.on("player:left", this.onPlayerLeft);
    socket.on("chat:message", this.onChatMessage);
    if (socket.connected) this.join();
    else this.ctx.onStatus({ kind: "connecting" });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.teardown, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.teardown, this);
  }

  update(time: number, delta: number) {
    this.updateLocalMovement();
    this.updateRemotes(delta);
    this.updateZone();

    const view = this.cameras.main.worldView;
    this.viewportBox.setPosition(view.x, view.y).setSize(view.width, view.height);

    if (!this.selfId) return;
    this.maybeEmitMove(time);
    if (time - this.lastProximityAt >= PROXIMITY_INTERVAL_MS) {
      this.lastProximityAt = time;
      this.updateProximity();
    }
  }

  // --- Minimapa ---------------------------------------------------------------

  private createMinimap(map: Phaser.Tilemaps.Tilemap) {
    const zoom = MINIMAP_WIDTH / map.widthInPixels;
    const height = Math.round(map.heightInPixels * zoom);
    this.minimap = this.cameras
      .add(MINIMAP_MARGIN.x, MINIMAP_MARGIN.y, MINIMAP_WIDTH, height, false, "minimap")
      .setZoom(zoom)
      .setBackgroundColor("rgba(11,14,26,0.85)")
      .centerOn(map.widthInPixels / 2, map.heightInPixels / 2);
    this.minimap.roundPixels = false;

    // Retângulo do que a câmera principal está mostrando, só no minimapa.
    this.viewportBox = this.add
      .rectangle(0, 0, 1, 1)
      .setOrigin(0)
      .setStrokeStyle(2 / zoom, 0xffffff, 0.6)
      .setDepth(DEPTH.overlay);
    this.cameras.main.ignore(this.viewportBox);
  }

  // --- Movimento local (WASD / setas) ---------------------------------------

  private updateLocalMovement() {
    const k = this.keys;
    const typing = isTyping();
    const vx = typing ? 0 : Number(k.D.isDown || k.RIGHT.isDown) - Number(k.A.isDown || k.LEFT.isDown);
    const vy = typing ? 0 : Number(k.S.isDown || k.DOWN.isDown) - Number(k.W.isDown || k.UP.isDown);

    // Normaliza para a diagonal não ser √2 mais rápida.
    const velocity = new Phaser.Math.Vector2(vx, vy).normalize().scale(SPEED);
    const { sprite } = this.me;
    sprite.setVelocity(velocity.x, velocity.y);

    if (vy < 0) this.direction = "up";
    else if (vy > 0) this.direction = "down";
    else if (vx < 0) this.direction = "left";
    else if (vx > 0) this.direction = "right";

    this.animate(this.me, this.direction, vx !== 0 || vy !== 0);
    this.radius.setPosition(sprite.x, sprite.y);
    this.positionDecor(this.me);
  }

  private currentState(): SentState {
    const { sprite } = this.me;
    return {
      x: Math.round(sprite.x),
      y: Math.round(sprite.y),
      direction: this.direction,
      moving: sprite.body!.velocity.lengthSq() > 0,
      zoneId: this.currentZone?.id ?? null,
    };
  }

  private updateZone() {
    const zone = zoneAt(this.zones, this.me.sprite.x, this.me.sprite.y);
    if (zone?.id === this.currentZone?.id) return;

    if (this.currentZone) this.zoneHighlights.get(this.currentZone.id)?.setVisible(false);
    if (zone) this.zoneHighlights.get(zone.id)?.setVisible(true);
    this.currentZone = zone;
    // Dentro de zona o raio não vale (a sala inteira se ouve), então o círculo some.
    this.radius.setVisible(!zone);
    this.ctx.onZoneChange(zone ? { id: zone.id, name: zone.name } : null);
  }

  /**
   * Emite `player:move` só quando algo mudou, limitado a ~15Hz. Iniciar ou
   * parar o movimento, ou trocar de zona, sai na hora (fura o limite), porque
   * é o que os outros clientes precisam para parar o avatar no lugar certo e
   * recalcular a mídia.
   */
  private maybeEmitMove(time: number) {
    const next = this.currentState();
    const prev = this.lastSent;
    if (
      prev &&
      prev.x === next.x &&
      prev.y === next.y &&
      prev.direction === next.direction &&
      prev.moving === next.moving &&
      prev.zoneId === next.zoneId
    ) {
      return;
    }

    const urgent = !prev || prev.moving !== next.moving || prev.zoneId !== next.zoneId;
    if (!urgent && time - this.lastEmitAt < MOVE_EMIT_INTERVAL_MS) return;

    this.ctx.socket.emit("player:move", next);
    this.lastSent = next;
    this.lastEmitAt = time;
  }

  // --- Avatares ----------------------------------------------------------------

  private createDecor(name: string, labelColor: string, dotColor: number, x: number, y: number) {
    const label = this.add
      .text(x, y, name, {
        fontFamily: "monospace",
        fontSize: "10px",
        color: labelColor,
        backgroundColor: "#00000099",
        padding: { x: 3, y: 1 },
      })
      .setOrigin(0.5, 1)
      .setResolution(2);
    this.minimap.ignore(label);

    const dot = this.add.circle(x, y, 28, dotColor).setDepth(DEPTH.overlay);
    this.cameras.main.ignore(dot);

    return { label, dot, bubble: null, bubbleTimer: null };
  }

  private animate(view: AvatarView, direction: Direction, moving: boolean) {
    if (moving) {
      view.sprite.anims.play(walkAnimKey(view.textureKey, direction), true);
    } else {
      view.sprite.anims.stop();
      view.sprite.setFrame(idleFrame(direction));
    }
  }

  private positionDecor(view: AvatarView) {
    const { x, y } = view.sprite;
    view.sprite.setDepth(y);
    const top = y - AVATAR_SIZE / 2;
    view.label.setPosition(x, top).setDepth(DEPTH.overlay + y);
    view.bubble?.setPosition(x, top - 14).setDepth(DEPTH.overlay + 1_000 + y);
    view.dot.setPosition(x, y);
  }

  private updateRemotes(delta: number) {
    // Interpolação exponencial independente de FPS: suaviza os saltos entre
    // pacotes (~15Hz) sem acumular atraso.
    const t = 1 - Math.exp(-delta / REMOTE_SMOOTHING_MS);
    for (const remote of this.remotes.values()) {
      const { sprite, state, ring } = remote;
      sprite.x += (state.x - sprite.x) * t;
      sprite.y += (state.y - sprite.y) * t;
      // Continua animando enquanto ainda está "chegando" na posição final.
      const settling = Math.abs(state.x - sprite.x) + Math.abs(state.y - sprite.y) > 1;
      this.animate(remote, state.direction, state.moving || settling);
      this.positionDecor(remote);
      ring.setPosition(sprite.x, sprite.y + 9).setDepth(DEPTH.ring);
    }
  }

  private upsertRemote(player: PlayerState) {
    const existing = this.remotes.get(player.id);
    if (existing) {
      existing.state = { ...player };
      return;
    }
    // O visual vem do servidor (que o recebeu assinado no ticket), então todo
    // mundo vê a mesma pessoa com a mesma roupa.
    const textureKey = ensureAvatar(this, player.avatar);
    const sprite = this.add.sprite(player.x, player.y, textureKey, idleFrame(player.direction));
    this.minimap.ignore(sprite);
    const ring = this.add
      .ellipse(player.x, player.y + 9, 24, 9)
      .setStrokeStyle(2, 0x4ade80, 0.9)
      .setVisible(false);
    this.minimap.ignore(ring);
    const decor = this.createDecor(player.name, "#ffffff", 0xf8fafc, player.x, player.y);
    this.remotes.set(player.id, { ...decor, sprite, textureKey, ring, state: { ...player } });
  }

  private removeRemote(id: string) {
    const remote = this.remotes.get(id);
    if (!remote) return;
    remote.bubbleTimer?.remove();
    for (const obj of [remote.sprite, remote.label, remote.dot, remote.ring, remote.bubble]) {
      obj?.destroy();
    }
    this.remotes.delete(id);
  }

  private clearRemotes() {
    for (const id of [...this.remotes.keys()]) this.removeRemote(id);
  }

  private showBubble(view: AvatarView, text: string) {
    view.bubbleTimer?.remove();
    view.bubble?.destroy();
    view.bubble = this.add
      .text(0, 0, text, {
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        fontSize: "11px",
        color: "#0f172a",
        backgroundColor: "#f8fafcee",
        padding: { x: 6, y: 4 },
        wordWrap: { width: 160, useAdvancedWrap: true },
        maxLines: 4,
      })
      .setOrigin(0.5, 1)
      .setResolution(2);
    this.minimap.ignore(view.bubble);
    this.positionDecor(view);
    view.bubbleTimer = this.time.delayedCall(BUBBLE_MS, () => {
      view.bubble?.destroy();
      view.bubble = null;
      view.bubbleTimer = null;
    });
  }

  // --- Proximidade → mídia ---------------------------------------------------

  private updateProximity() {
    const local = this.currentState();
    const decisions = decideMedia(
      { id: this.selfId!, x: local.x, y: local.y, zoneId: local.zoneId },
      [...this.remotes.values()].map((r) => r.state),
      this.lastDecisions,
    );
    this.lastDecisions = decisions;
    this.ctx.media.apply(decisions);

    const nearby: NearbyPeer[] = [];
    for (const [id, decision] of decisions) {
      const remote = this.remotes.get(id);
      if (!remote) continue;
      remote.label.setAlpha(decision.active ? 1 : 0.55);
      remote.ring.setVisible(decision.active);
      if (decision.active) {
        nearby.push({
          id,
          name: remote.state.name,
          distance: Math.round(decision.distance),
          reason: decision.reason,
        });
      }
    }
    nearby.sort((a, b) => a.distance - b.distance);

    // Só avisa o React quando a lista muda, não a cada 200ms.
    const key = nearby.map((p) => `${p.id}:${p.reason}`).join("|");
    if (key !== this.lastNearbyKey) {
      this.lastNearbyKey = key;
      this.ctx.onNearbyChange(nearby);
    }
  }

  // --- Handlers de socket (arrow functions para manter o `this` no off) ----

  private join = () => {
    const { socket, spaceId } = this.ctx;
    const { sprite } = this.me;
    socket.emit("room:join", { spaceId, x: sprite.x, y: sprite.y }, (res) => {
      if (this.disposed) return;
      if (!res.ok) {
        this.ctx.onStatus({ kind: "error", message: res.error });
        return;
      }
      this.selfId = res.selfId;
      this.lastSent = null;
      this.lastDecisions = new Map();
      this.lastNearbyKey = "";
      this.clearRemotes();
      for (const p of res.players) this.upsertRemote(p);

      this.ctx.onStatus({ kind: "joined", media: res.livekit !== null });
      if (res.livekit) {
        this.ctx.media.connect(res.livekit).catch((err) => {
          console.error("[media] falha ao conectar no LiveKit", err);
        });
      }
    });
  };

  private onDisconnect = () => {
    if (this.disposed) return;
    // Ao reconectar o socket.id muda, então a identidade de mídia também:
    // o `connect` dispara um novo join, que traz um token LiveKit novo.
    this.selfId = null;
    this.ctx.onNearbyChange([]);
    this.ctx.onStatus({ kind: "reconnecting" });
  };

  private onConnectError = (err: Error) => {
    if (this.disposed) return;
    // Erro de rede: o Socket.io segue tentando sozinho (socket.active).
    // Recusa do servidor (ticket inválido: sessão expirou ou o vínculo com o
    // space foi removido) encerra as tentativas — e a mídia junto.
    if (this.ctx.socket.active) return;
    void this.ctx.media.disconnect();
    this.ctx.onStatus({
      kind: "error",
      message:
        err.message === UNAUTHORIZED
          ? "sessão expirada ou sem acesso — recarregue a página"
          : err.message,
    });
  };

  private onPlayerJoined = (player: PlayerState) => {
    if (this.disposed || player.id === this.selfId) return;
    this.upsertRemote(player);
  };

  private onPlayerMoved = (move: PlayerMove) => {
    if (this.disposed) return;
    const remote = this.remotes.get(move.id);
    if (remote) Object.assign(remote.state, move);
  };

  private onPlayerLeft = (id: string) => {
    if (this.disposed) return;
    this.removeRemote(id);
  };

  private onChatMessage = (message: ChatMessage) => {
    if (this.disposed) return;
    const view = message.playerId === this.selfId ? this.me : this.remotes.get(message.playerId);
    if (view) this.showBubble(view, message.text);
  };

  private teardown() {
    if (this.disposed) return;
    this.disposed = true;
    const { socket } = this.ctx;
    socket.off("connect", this.join);
    socket.off("disconnect", this.onDisconnect);
    socket.off("connect_error", this.onConnectError);
    socket.off("player:joined", this.onPlayerJoined);
    socket.off("player:moved", this.onPlayerMoved);
    socket.off("player:left", this.onPlayerLeft);
    socket.off("chat:message", this.onChatMessage);
  }
}

/** Movimento fica travado enquanto o foco está num campo de texto da HUD. */
function isTyping(): boolean {
  const el = document.activeElement;
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    (el instanceof HTMLElement && el.isContentEditable)
  );
}
