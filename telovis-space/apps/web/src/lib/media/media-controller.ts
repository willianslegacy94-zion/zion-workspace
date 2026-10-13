import {
  RemoteAudioTrack,
  Room,
  RoomEvent,
  Track,
  type RemoteParticipant,
  type RemoteTrack,
  type RemoteTrackPublication,
} from "livekit-client";
import type { LivekitCredentials } from "@telovis/protocol";
import type { MediaDecision, MediaDecisions } from "@/lib/proximity/proximity";

export interface MediaState {
  connected: boolean;
  micOn: boolean;
  camOn: boolean;
  /** false quando o navegador bloqueou autoplay e precisa de um clique. */
  canPlayAudio: boolean;
}

const INITIAL_STATE: MediaState = {
  connected: false,
  micOn: false,
  camOn: false,
  canPlayAudio: true,
};

/**
 * Aplica as decisões de proximidade na sala LiveKit.
 *
 * A sala conecta com autoSubscribe desligado: ninguém recebe a mídia de
 * ninguém até a proximidade decidir. "Mutar" um colega = cancelar a assinatura
 * das faixas dele, o que faz o SFU parar de encaminhar os pacotes (economiza
 * banda de verdade, ao contrário de só zerar o volume no navegador).
 *
 * A identity de cada participante LiveKit é o socket.id do jogador — é o
 * servidor realtime que emite o token —, então decisions.get(identity) liga
 * avatar e mídia sem tabela de tradução.
 */
export class MediaController {
  private room: Room | null = null;
  private decisions: MediaDecisions = new Map();
  private state: MediaState = INITIAL_STATE;
  private listeners = new Set<(s: MediaState) => void>();

  /** @param container elemento onde os <video>/<audio> remotos são inseridos. */
  constructor(private readonly container: HTMLElement) {}

  getState(): MediaState {
    return this.state;
  }

  subscribe(listener: (s: MediaState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async connect(credentials: LivekitCredentials): Promise<void> {
    await this.disconnect();

    const room = new Room({ adaptiveStream: true, dynacast: true });
    this.room = room;

    room
      .on(RoomEvent.TrackPublished, (pub, participant) =>
        this.applyToPublication(pub, this.decisions.get(participant.identity)),
      )
      .on(RoomEvent.TrackSubscribed, (track, _pub, participant) =>
        this.attach(track, participant),
      )
      .on(RoomEvent.TrackUnsubscribed, (track) => this.detach(track))
      .on(RoomEvent.AudioPlaybackStatusChanged, () =>
        this.setState({ canPlayAudio: room.canPlaybackAudio }),
      )
      .on(RoomEvent.Disconnected, () => {
        if (this.room === room) this.setState({ ...INITIAL_STATE });
      });

    await room.connect(credentials.url, credentials.token, { autoSubscribe: false });
    if (this.room !== room) return; // substituída por outra connect() no meio
    this.setState({ connected: true, canPlayAudio: room.canPlaybackAudio });
    this.apply(this.decisions);
  }

  async disconnect(): Promise<void> {
    const room = this.room;
    this.room = null;
    if (room) await room.disconnect();
    this.container.replaceChildren();
    this.setState({ ...INITIAL_STATE });
  }

  /** Chamado pela cena a cada rodada do cálculo de proximidade. */
  apply(decisions: MediaDecisions): void {
    this.decisions = decisions;
    const room = this.room;
    if (!room) return;

    for (const participant of room.remoteParticipants.values()) {
      const decision = decisions.get(participant.identity);
      for (const pub of participant.trackPublications.values()) {
        this.applyToPublication(pub, decision);
      }
    }
  }

  async setMicrophone(on: boolean): Promise<void> {
    if (!this.room) return;
    await this.room.localParticipant.setMicrophoneEnabled(on);
    this.setState({ micOn: on });
  }

  async setCamera(on: boolean): Promise<void> {
    if (!this.room) return;
    await this.room.localParticipant.setCameraEnabled(on);
    this.setState({ camOn: on });
  }

  /** Precisa rodar dentro de um handler de clique (política de autoplay). */
  async unlockAudio(): Promise<void> {
    await this.room?.startAudio();
  }

  private applyToPublication(pub: RemoteTrackPublication, decision: MediaDecision | undefined) {
    const shouldSubscribe = decision?.active ?? false;
    if (pub.isSubscribed !== shouldSubscribe) pub.setSubscribed(shouldSubscribe);
    if (shouldSubscribe && pub.track instanceof RemoteAudioTrack) {
      pub.track.setVolume(decision!.volume);
    }
  }

  private attach(track: RemoteTrack, participant: RemoteParticipant) {
    if (track instanceof RemoteAudioTrack) {
      track.setVolume(this.decisions.get(participant.identity)?.volume ?? 0);
    }
    const el = track.attach();
    el.dataset.identity = participant.identity;
    if (track.kind === Track.Kind.Video) {
      el.className = "h-28 w-40 rounded-lg bg-black object-cover shadow-lg";
    }
    this.container.appendChild(el);
  }

  private detach(track: RemoteTrack) {
    for (const el of track.detach()) el.remove();
  }

  private setState(patch: Partial<MediaState>) {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener(this.state);
  }
}
