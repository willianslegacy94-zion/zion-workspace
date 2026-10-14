import Phaser from "phaser";
import {
  AWAY_STATUS_LABELS,
  EARSHOT_RADIUS,
  freeDesk,
  type AwayStatus,
  type AvatarLook,
  type ChatMessage,
  type DeskOwner,
  type DeskSetup,
  type DeskState,
  type Direction,
  type PlayerMove,
  type PlayerState,
  type Vehicle,
} from "@telovis/protocol";
import { UNAUTHORIZED, type SpaceSocket } from "@/lib/space/socket";
import type { MediaController } from "@/lib/media/media-controller";
import {
  decideMedia,
  type DecisionReason,
  type MediaDecisions,
} from "@/lib/proximity/proximity";
import {
  areaAt,
  parseAreas,
  parseDeskSlots,
  parseSeats,
  parseVehicleStations,
  parseZones,
  zoneAt,
  type DeskSlot,
  type MapArea,
  type PrivateZone,
  type Seat,
  type VehicleStation,
} from "../zones";
import { DESK_H, DESK_TEX_H, DESK_W, deskTextureKey, drawDesk } from "../desk-draw";
import { AVATAR_SIZE, ensureAvatar, idleFrame, sitFrame, walkAnimKey } from "../avatar";
import { ensureVehicle } from "../vehicle";
import { VEHICLE_ANCHOR, VEHICLE_FRAME, vehicleFrame, vehicleInFront } from "../vehicle-draw";

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
  status: AwayStatus | null;
}

export interface ZoneInfo {
  id: string;
  name: string;
}

/** Mesa ao alcance do jogador local (para a HUD oferecer pegar/montar). */
export interface DeskFocus {
  key: string;
  owner: DeskOwner | null;
  mine: boolean;
  setup: DeskSetup;
}

/** O que a tecla E faz com veículo agora: subir (perto da garagem) ou descer. */
export interface VehicleFocus {
  action: "mount" | "dismount";
  vehicle: Vehicle;
}

/** Comandos que a HUD (React) dispara na cena. */
export interface SceneApi {
  toggleVehicle: () => void;
}

export interface OfficeSceneData {
  socket: SpaceSocket;
  media: MediaController;
  spaceId: string;
  userId: string;
  playerName: string;
  /** Mesas com dono no carregamento; depois, `desk:updated` mantém em dia. */
  desks: DeskState[];
  avatar: AvatarLook;
  mapJsonUrl: string;
  tilesetUrl: string;
  onStatus: (status: SceneStatus) => void;
  onNearbyChange: (peers: NearbyPeer[]) => void;
  onZoneChange: (zone: ZoneInfo | null) => void;
  onAreaChange: (area: string | null) => void;
  onDeskFocus: (desk: DeskFocus | null) => void;
  onVehicleFocus: (focus: VehicleFocus | null) => void;
  onReady: (api: SceneApi) => void;
}

const SPEED: Record<Vehicle | "walk", number> = { walk: 160, patinete: 240, kart: 310 }; // px/s
const MOVE_EMIT_INTERVAL_MS = 66; // ~15Hz; o servidor descarta acima de ~30Hz
const PROXIMITY_INTERVAL_MS = 200; // 5Hz basta para ligar/desligar mídia
const REMOTE_SMOOTHING_MS = 90; // constante de tempo da interpolação remota
const BUBBLE_MS = 6_000;
const MINIMAP_WIDTH = 200;
const MINIMAP_MARGIN = { x: 12, y: 64 }; // abaixo do cabeçalho da HUD

// Camadas de desenho. Avatares usam depth = y (quem está mais embaixo na tela
// fica na frente); decoração de mundo fica abaixo deles, textos acima.
const DEPTH = { areas: 1, zones: 1, radius: 2, ring: 3, overlay: 100_000 } as const;

/** Distância (px) do jogador até a cadeira para a mesa entrar em foco. */
const DESK_REACH = 40;
/** Distância (px) até o ponto da garagem para poder pegar o veículo. */
const VEHICLE_REACH = 36;
/** Troca de quadro das rodas em movimento. */
const WHEEL_FRAME_MS = 110;
/** Parado este tempo perto de um assento, o avatar senta sozinho. */
const SIT_DELAY_MS = 350;
const SIT_REACH = 16;
/** Índice de "Em pé" em DESK_MODELS: mesa sem cadeira. */
const STANDING_DESK_MODEL = 1;
/** Avatar de quem está ausente fica meio apagado. */
const AWAY_ALPHA = 0.55;

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
  vehicle: Vehicle | null;
  vehicleSprite: Phaser.GameObjects.Sprite | null;
  name: string;
  status: AwayStatus | null;
}

interface RemoteAvatar extends AvatarView {
  state: PlayerState;
  /** Anel sob o avatar quando a mídia dele está ativa para você. */
  ring: Phaser.GameObjects.Ellipse;
}

interface DeskView {
  slot: DeskSlot;
  state: DeskState;
  image: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
}

interface SentState {
  x: number;
  y: number;
  direction: Direction;
  moving: boolean;
  zoneId: string | null;
  vehicle: Vehicle | null;
  sitting: boolean;
}

export class OfficeScene extends Phaser.Scene {
  private ctx!: OfficeSceneData;
  private me!: AvatarView & { sprite: Phaser.Physics.Arcade.Sprite };
  private keys!: MoveKeys;
  private zones: PrivateZone[] = [];
  private zoneHighlights = new Map<string, Phaser.GameObjects.Rectangle>();
  private areas: MapArea[] = [];
  private currentArea: string | null = null;
  private desks = new Map<string, DeskView>();
  private deskHighlight!: Phaser.GameObjects.Rectangle;
  private focusedDesk: string | null = null;
  private lastFocusKey = "";
  private stations: VehicleStation[] = [];
  private focusedStation: VehicleStation | null = null;
  private lastVehicleFocusKey = "";
  private seats: Seat[] = [];
  private sitting = false;
  private idleSince = 0;
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
  /** O servidor expulsou esta sessão: não mostrar "Reconectando…". */
  private revoked = false;

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
    // Cadeiras, puffs etc.: desenhados, mas sem colisão. Opcional no mapa.
    if (map.getLayerIndex("decor") !== null) map.createLayer("decor", tileset);
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

    // --- Áreas abertas (nome no chão) ----------------------------------------
    this.areas = parseAreas(map);
    for (const area of this.areas) {
      // Centro da borda de baixo: os cantos de cima costumam ter móveis
      // encostados na parede (geladeira, planta, balcão).
      const label = this.add
        .text(area.bounds.centerX, area.bounds.bottom - 6, area.name.toUpperCase(), {
          fontFamily: "monospace",
          fontSize: "14px",
          fontStyle: "bold",
          color: "#1f2433",
        })
        .setOrigin(0.5, 1)
        .setAlpha(0.28)
        .setDepth(DEPTH.areas)
        .setResolution(2);
      this.minimap.ignore(label);
    }

    // --- Mesas de trabalho ---------------------------------------------------
    const claimed = new Map(this.ctx.desks.map((d) => [d.key, d]));
    const deskBodies: Phaser.GameObjects.Zone[] = [];
    for (const slot of parseDeskSlots(map)) {
      const state = claimed.get(slot.key) ?? freeDesk(slot.key);
      const image = this.add
        .image(slot.x, slot.y, this.ensureDeskTexture(state))
        .setOrigin(0)
        // Quem passa atrás do tampo fica atrás; quem está na cadeira, na frente.
        .setDepth(slot.y + DESK_H);
      const label = this.add
        .text(slot.x + DESK_W / 2, slot.y + DESK_TEX_H, "", {
          fontFamily: "monospace",
          fontSize: "9px",
          color: "#f8fafc",
          backgroundColor: "#00000066",
          padding: { x: 2, y: 0 },
        })
        .setOrigin(0.5, 0)
        .setDepth(slot.y + DESK_H)
        .setResolution(2);
      this.minimap.ignore(label);
      const view: DeskView = { slot, state, image, label };
      this.desks.set(slot.key, view);
      this.renderDesk(view);

      // Só o tampo colide (a cadeira fica livre para "sentar").
      const body = this.add.zone(slot.x + DESK_W / 2, slot.y + DESK_H / 2, DESK_W - 4, DESK_H - 8);
      this.physics.add.existing(body, true);
      deskBodies.push(body);
    }
    this.deskHighlight = this.add
      .rectangle(0, 0, DESK_W + 6, DESK_TEX_H + 4)
      .setOrigin(0)
      .setStrokeStyle(2, 0xfacc15, 0.9)
      .setDepth(DEPTH.overlay - 1)
      .setVisible(false);
    this.minimap.ignore(this.deskHighlight);

    this.seats = parseSeats(map);

    // --- Garagens de kart e patinete -----------------------------------------
    this.stations = parseVehicleStations(map);
    const spots = this.add.graphics().setDepth(DEPTH.areas);
    for (const { x, y, vehicle } of this.stations) {
      spots.lineStyle(2, 0xfacc15, 0.55).strokeRect(x - 18, y - 14, 36, 30);
      // Veículo estacionado de enfeite: a garagem nunca esvazia.
      const parked = this.add
        .sprite(x, y, ensureVehicle(this, vehicle), vehicleFrame("right", 0))
        .setOrigin(VEHICLE_ANCHOR.x / VEHICLE_FRAME, VEHICLE_ANCHOR.y / VEHICLE_FRAME)
        .setDepth(y);
      this.minimap.ignore(parked);
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
    if (deskBodies.length) this.physics.add.collider(sprite, deskBodies);

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
    socket.on("player:updated", this.onPlayerUpdated);
    socket.on("player:left", this.onPlayerLeft);
    socket.on("chat:message", this.onChatMessage);
    socket.on("session:revoked", this.onSessionRevoked);
    socket.on("desk:updated", this.onDeskUpdated);
    socket.on("player:status", this.onPlayerStatus);
    if (socket.connected) this.join();
    else this.ctx.onStatus({ kind: "connecting" });

    // Só em dev: deixa testes de navegador lerem/posicionarem o jogador.
    if (process.env.NODE_ENV !== "production") {
      (window as unknown as { __officeScene?: OfficeScene }).__officeScene = this;
    }

    this.ctx.onReady({ toggleVehicle: () => this.toggleVehicle() });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.teardown, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.teardown, this);
  }

  update(time: number, delta: number) {
    this.updateLocalMovement();
    this.updateRemotes(delta);
    this.updateZone();
    this.updateDeskFocus();
    this.updateVehicleFocus();

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
    this.updateSitting(vx !== 0 || vy !== 0);

    const speed = SPEED[this.me.vehicle ?? "walk"];
    const velocity = new Phaser.Math.Vector2(vx, vy).normalize().scale(speed);
    const { sprite } = this.me;
    sprite.setVelocity(velocity.x, velocity.y);

    if (vy < 0) this.direction = "up";
    else if (vy > 0) this.direction = "down";
    else if (vx < 0) this.direction = "left";
    else if (vx > 0) this.direction = "right";

    this.animate(this.me, this.direction, vx !== 0 || vy !== 0, this.sitting);
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
      vehicle: this.me.vehicle,
      sitting: this.sitting,
    };
  }

  private updateZone() {
    const area = areaAt(this.areas, this.me.sprite.x, this.me.sprite.y)?.name ?? null;
    if (area !== this.currentArea) {
      this.currentArea = area;
      this.ctx.onAreaChange(area);
    }

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
      prev.zoneId === next.zoneId &&
      prev.vehicle === next.vehicle &&
      prev.sitting === next.sitting
    ) {
      return;
    }

    const urgent =
      !prev ||
      prev.moving !== next.moving ||
      prev.zoneId !== next.zoneId ||
      prev.vehicle !== next.vehicle ||
      prev.sitting !== next.sitting;
    if (!urgent && time - this.lastEmitAt < MOVE_EMIT_INTERVAL_MS) return;

    this.ctx.socket.emit("player:move", next);
    this.lastSent = next;
    this.lastEmitAt = time;
  }

  // --- Mesas ------------------------------------------------------------------

  private ensureDeskTexture(state: DeskState): string {
    const claimed = state.owner !== null;
    const key = deskTextureKey(state.setup, claimed);
    if (this.textures.exists(key)) return key;
    const tex = this.textures.createCanvas(key, DESK_W, DESK_TEX_H);
    if (!tex) throw new Error("Falha ao criar a textura da mesa");
    drawDesk(tex.getContext(), state.setup, claimed);
    tex.refresh();
    return key;
  }

  private renderDesk(view: DeskView) {
    view.image.setTexture(this.ensureDeskTexture(view.state));
    const owner = view.state.owner;
    view.label.setText(owner ? owner.name : "").setVisible(owner !== null);
  }

  /** Mesa cuja cadeira está ao alcance do jogador, ou null. */
  private updateDeskFocus() {
    const { x, y } = this.me.sprite;
    let best: DeskView | null = null;
    let bestDist = DESK_REACH;
    // De kart ou patinete não se mexe em mesa: o E serve para descer.
    const desks = this.me.vehicle ? [] : this.desks.values();
    for (const view of desks) {
      const seatX = view.slot.x + DESK_W / 2;
      const seatY = view.slot.y + DESK_H + 12;
      const d = Math.hypot(seatX - x, seatY - y);
      if (d < bestDist) {
        best = view;
        bestDist = d;
      }
    }

    this.focusedDesk = best?.slot.key ?? null;
    if (best) this.deskHighlight.setPosition(best.slot.x - 3, best.slot.y - 2);
    this.deskHighlight.setVisible(best !== null);

    // Só avisa o React quando muda a mesa ou o estado dela.
    const state = best?.state;
    const key = state
      ? `${state.key}|${state.owner?.userId ?? ""}|${deskTextureKey(state.setup, true)}`
      : "";
    if (key === this.lastFocusKey) return;
    this.lastFocusKey = key;
    this.ctx.onDeskFocus(
      state
        ? {
            key: state.key,
            owner: state.owner,
            mine: state.owner?.userId === this.ctx.userId,
            setup: state.setup,
          }
        : null,
    );
  }

  // --- Sentar ------------------------------------------------------------------

  /**
   * Andar levanta; ficar parado perto de um assento (cadeira de mesa, cadeira
   * de sala, puff) senta: o avatar encaixa no lugar e vira para a mesa.
   */
  private updateSitting(moving: boolean) {
    const now = this.time.now;
    if (moving || this.me.vehicle) {
      this.sitting = false;
      this.idleSince = now;
      return;
    }
    if (this.sitting || now - this.idleSince < SIT_DELAY_MS) return;

    const seat = this.nearestSeat();
    if (!seat) return;
    this.me.sprite.body!.reset(seat.x, seat.y);
    this.direction = seat.facing;
    this.sitting = true;
  }

  private nearestSeat(): Seat | null {
    const { x, y } = this.me.sprite;
    let best: Seat | null = null;
    let bestDist = SIT_REACH;
    const consider = (seat: Seat) => {
      const d = Math.hypot(seat.x - x, seat.y - y);
      if (d < bestDist) {
        best = seat;
        bestDist = d;
      }
    };
    this.seats.forEach(consider);
    for (const view of this.desks.values()) {
      if (view.state.owner && view.state.setup.model === STANDING_DESK_MODEL) continue;
      consider({ x: view.slot.x + DESK_W / 2, y: view.slot.y + DESK_H + 12, facing: "up" });
    }
    return best;
  }

  // --- Ausência -----------------------------------------------------------------

  private setStatus(view: AvatarView, status: AwayStatus | null) {
    view.status = status;
    view.label.setText(status ? `${view.name} · ${AWAY_STATUS_LABELS[status]}` : view.name);
    view.sprite.setAlpha(status ? AWAY_ALPHA : 1);
    view.vehicleSprite?.setAlpha(status ? AWAY_ALPHA : 1);
    view.label.setFontStyle(status ? "italic" : "normal");
  }

  // --- Veículos ----------------------------------------------------------------

  private updateVehicleFocus() {
    const { x, y } = this.me.sprite;
    let best: VehicleStation | null = null;
    let bestDist = VEHICLE_REACH;
    if (!this.me.vehicle) {
      for (const station of this.stations) {
        const d = Math.hypot(station.x - x, station.y - y);
        if (d < bestDist) {
          best = station;
          bestDist = d;
        }
      }
    }
    this.focusedStation = best;

    const focus: VehicleFocus | null = this.me.vehicle
      ? { action: "dismount", vehicle: this.me.vehicle }
      : best
        ? { action: "mount", vehicle: best.vehicle }
        : null;
    const key = focus ? focus.action + ":" + focus.vehicle : "";
    if (key === this.lastVehicleFocusKey) return;
    this.lastVehicleFocusKey = key;
    this.ctx.onVehicleFocus(focus);
  }

  /** Sobe no veículo da garagem ao alcance, ou desce do atual. */
  toggleVehicle() {
    if (this.disposed) return;
    if (this.me.vehicle) this.setVehicle(this.me, null);
    else if (this.focusedStation) this.setVehicle(this.me, this.focusedStation.vehicle);
  }

  private setVehicle(view: AvatarView, vehicle: Vehicle | null) {
    if (view.vehicle === vehicle) return;
    view.vehicleSprite?.destroy();
    view.vehicleSprite = null;
    view.vehicle = vehicle;
    if (vehicle) {
      view.vehicleSprite = this.add
        .sprite(view.sprite.x, view.sprite.y, ensureVehicle(this, vehicle), 0)
        .setOrigin(VEHICLE_ANCHOR.x / VEHICLE_FRAME, VEHICLE_ANCHOR.y / VEHICLE_FRAME);
      this.minimap.ignore(view.vehicleSprite);
    }
    this.positionDecor(view);
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

    return {
      label,
      dot,
      bubble: null,
      bubbleTimer: null,
      vehicle: null,
      vehicleSprite: null,
      name,
      status: null,
    };
  }

  private animate(view: AvatarView, direction: Direction, moving: boolean, sitting: boolean) {
    if (sitting && !view.vehicleSprite) {
      view.sprite.anims.stop();
      view.sprite.setFrame(sitFrame(direction));
      return;
    }
    if (view.vehicleSprite) {
      // Em cima do veículo o avatar fica parado; quem "anda" são as rodas.
      view.sprite.anims.stop();
      view.sprite.setFrame(idleFrame(direction));
      const phase = moving ? Math.floor(this.time.now / WHEEL_FRAME_MS) : 0;
      view.vehicleSprite.setFrame(vehicleFrame(direction, phase));
      return;
    }
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
    if (view.vehicle && view.vehicleSprite) {
      view.vehicleSprite.setPosition(x, y).setDepth(y + (vehicleInFront(view.vehicle) ? 0.5 : -0.5));
    }
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
      this.animate(remote, state.direction, state.moving || settling, state.sitting && !settling);
      this.positionDecor(remote);
      ring.setPosition(sprite.x, sprite.y + 9).setDepth(DEPTH.ring);
    }
  }

  private upsertRemote(player: PlayerState) {
    const existing = this.remotes.get(player.id);
    if (existing) {
      existing.state = { ...player };
      this.setVehicle(existing, player.vehicle);
      this.setStatus(existing, player.status);
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
    const remote: RemoteAvatar = { ...decor, sprite, textureKey, ring, state: { ...player } };
    this.remotes.set(player.id, remote);
    this.setVehicle(remote, player.vehicle);
    this.setStatus(remote, player.status);
  }

  private removeRemote(id: string) {
    const remote = this.remotes.get(id);
    if (!remote) return;
    remote.bubbleTimer?.remove();
    const parts = [remote.sprite, remote.label, remote.dot, remote.ring, remote.bubble, remote.vehicleSprite];
    for (const obj of parts) {
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
          status: remote.state.status,
        });
      }
    }
    nearby.sort((a, b) => a.distance - b.distance);

    // Só avisa o React quando a lista muda, não a cada 200ms.
    const key = nearby.map((p) => `${p.id}:${p.reason}:${p.status}`).join("|");
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
    if (this.disposed || this.revoked) return;
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
    if (!remote) return;
    Object.assign(remote.state, move);
    this.setVehicle(remote, move.vehicle);
  };

  private onPlayerUpdated = ({ id, avatar }: { id: string; avatar: AvatarLook }) => {
    if (this.disposed) return;
    const view = id === this.selfId ? this.me : this.remotes.get(id);
    if (!view) return;
    if (view !== this.me) (view as RemoteAvatar).state.avatar = avatar;
    // A animação em curso aponta para a textura antiga; trocar a textura e
    // deixar o próximo frame reaplicar parado/andando com a nova chave.
    view.textureKey = ensureAvatar(this, avatar);
    view.sprite.anims.stop();
    view.sprite.setTexture(view.textureKey, idleFrame(this.directionOf(view)));
  };

  private directionOf(view: AvatarView): Direction {
    return view === this.me ? this.direction : (view as RemoteAvatar).state.direction;
  }

  private onSessionRevoked = (reason: string) => {
    if (this.disposed) return;
    this.revoked = true;
    this.selfId = null;
    this.clearRemotes();
    void this.ctx.media.disconnect();
    this.ctx.onNearbyChange([]);
    this.ctx.onStatus({ kind: "error", message: reason });
  };

  private onDeskUpdated = (desk: DeskState) => {
    if (this.disposed) return;
    const view = this.desks.get(desk.key);
    if (!view) return;
    view.state = desk;
    this.renderDesk(view);
    // Força reenviar o foco se for a mesa em que o jogador está.
    if (this.focusedDesk === desk.key) this.lastFocusKey = "";
  };

  private onPlayerStatus = ({ id, status }: { id: string; status: AwayStatus | null }) => {
    if (this.disposed) return;
    if (id === this.selfId) {
      this.setStatus(this.me, status);
      return;
    }
    const remote = this.remotes.get(id);
    if (!remote) return;
    remote.state.status = status;
    this.setStatus(remote, status);
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
    socket.off("player:updated", this.onPlayerUpdated);
    socket.off("player:left", this.onPlayerLeft);
    socket.off("chat:message", this.onChatMessage);
    socket.off("session:revoked", this.onSessionRevoked);
    socket.off("desk:updated", this.onDeskUpdated);
    socket.off("player:status", this.onPlayerStatus);
  }
}

/**
 * Movimento fica travado enquanto o foco está num campo de texto da HUD ou
 * com um diálogo aberto (marcado com data-game-modal).
 */
function isTyping(): boolean {
  if (document.querySelector("[data-game-modal]")) return true;
  const el = document.activeElement;
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    (el instanceof HTMLElement && el.isContentEditable)
  );
}
