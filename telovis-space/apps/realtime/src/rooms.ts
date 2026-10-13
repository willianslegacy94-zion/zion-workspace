import type { PlayerMove, PlayerState } from "@telovis/protocol";

/**
 * Estado em memória dos jogadores por space. Suficiente para uma instância
 * única; para escalar horizontalmente, troque por Redis (Upstash) e ligue o
 * @socket.io/redis-adapter para o broadcast entre instâncias.
 */
export class RoomRegistry {
  private rooms = new Map<string, Map<string, PlayerState>>();

  /** Adiciona o jogador e devolve quem já estava na sala. */
  join(spaceId: string, player: PlayerState): PlayerState[] {
    let room = this.rooms.get(spaceId);
    if (!room) {
      room = new Map();
      this.rooms.set(spaceId, room);
    }
    const others = [...room.values()];
    room.set(player.id, player);
    return others;
  }

  get(spaceId: string, playerId: string): PlayerState | undefined {
    return this.rooms.get(spaceId)?.get(playerId);
  }

  players(spaceId: string): Iterable<PlayerState> {
    return this.rooms.get(spaceId)?.values() ?? [];
  }

  move(spaceId: string, move: PlayerMove): boolean {
    const player = this.rooms.get(spaceId)?.get(move.id);
    if (!player) return false;
    Object.assign(player, move);
    return true;
  }

  leave(spaceId: string, playerId: string): void {
    const room = this.rooms.get(spaceId);
    if (!room) return;
    room.delete(playerId);
    if (room.size === 0) this.rooms.delete(spaceId);
  }

  stats() {
    let players = 0;
    for (const room of this.rooms.values()) players += room.size;
    return { rooms: this.rooms.size, players };
  }
}
