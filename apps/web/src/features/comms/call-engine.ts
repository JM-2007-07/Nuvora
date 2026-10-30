'use client';

import type { ActiveCall, CallMedia, CallPeer, CallSignal, RtcConfig } from '@nuvora/shared';
import { COMMS_EVENTS } from '@nuvora/shared';
import type { Socket } from 'socket.io-client';

/*
 * One call at a time, peer to peer (WebRTC mesh: everyone connects to everyone; fine for one to
 * one and small groups). The server only relays signals (comms.gateway.ts).
 *
 * - Whoever joins sends the offer to each peer already in the call; the others answer.
 * - Every connection carries one audio and one video transceiver from the start, so turning the
 *   camera on or sharing the screen is a `replaceTrack`, never a renegotiation.
 * - ICE candidates that arrive before the remote description are queued.
 * - Mic / camera / screen state goes to the others as a small `call:media` event (to show a
 *   video tile or an avatar), re-sent whenever someone new joins.
 */

export type CallStatus = 'idle' | 'outgoing' | 'active' | 'ended';
export type CallError = 'mediaDenied' | 'unsupported' | 'failed' | null;

export interface RemotePeer extends CallPeer {
  stream: MediaStream | null;
  mic: boolean;
  camera: boolean;
  screen: boolean;
  state: RTCPeerConnectionState | 'new';
}

export interface CallSnapshot {
  status: CallStatus;
  callId: string | null;
  conversationId: string | null;
  title: string;
  media: CallMedia;
  peers: RemotePeer[];
  /** What I show in my own tile (camera or screen) */
  preview: MediaStream | null;
  mic: boolean;
  camera: boolean;
  screen: boolean;
  /** When the first other person joined (ms) */
  connectedAt: number | null;
  error: CallError;
  endedReason: string | null;
}

const IDLE: CallSnapshot = {
  status: 'idle',
  callId: null,
  conversationId: null,
  title: '',
  media: 'audio',
  peers: [],
  preview: null,
  mic: true,
  camera: false,
  screen: false,
  connectedAt: null,
  error: null,
  endedReason: null,
};

type Ack<T> = ({ ok: true } & T) | { ok: false; error: string };

export class CallEngine {
  private snap: CallSnapshot = IDLE;
  private readonly listeners = new Set<() => void>();
  private readonly pcs = new Map<string, RTCPeerConnection>();
  private readonly queued = new Map<string, RTCIceCandidateInit[]>();
  private audioTrack: MediaStreamTrack | null = null;
  private cameraTrack: MediaStreamTrack | null = null;
  private screenTrack: MediaStreamTrack | null = null;
  private resetTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly off: (() => void)[] = [];

  constructor(
    private readonly socket: Socket,
    private rtc: RtcConfig,
  ) {
    const on = <T>(event: string, handler: (payload: T) => void) => {
      socket.on(event, handler);
      this.off.push(() => socket.off(event, handler));
    };
    on<{ callId: string; peer: CallPeer }>(COMMS_EVENTS.callPeerJoined, ({ callId, peer }) => {
      if (callId !== this.snap.callId) return;
      this.addPeer(peer);
      this.connection(peer.peerId, false);
      this.set({ status: 'active', connectedAt: this.snap.connectedAt ?? Date.now() });
      this.announceMedia();
    });
    on<{ callId: string; from: string; data: CallSignal['data'] }>(COMMS_EVENTS.callSignal, ({ callId, from, data }) => {
      if (callId === this.snap.callId) void this.onSignal(from, data);
    });
    on<{ callId: string; peerId: string }>(COMMS_EVENTS.callPeerLeft, ({ callId, peerId }) => {
      if (callId !== this.snap.callId) return;
      this.closePeer(peerId);
      this.set({ peers: this.snap.peers.filter((p) => p.peerId !== peerId) });
    });
    on<{ callId: string; reason: string }>(COMMS_EVENTS.callEnded, ({ callId, reason }) => {
      if (callId === this.snap.callId) this.finish(reason);
    });
    on<{ callId: string; peerId: string; mic: boolean; camera: boolean; screen: boolean }>(COMMS_EVENTS.callMedia, ({ callId, peerId, mic, camera, screen }) => {
      if (callId !== this.snap.callId) return;
      this.set({ peers: this.snap.peers.map((p) => (p.peerId === peerId ? { ...p, mic, camera, screen } : p)) });
    });
    on('disconnect', () => {
      if (this.snap.callId) this.finish('ended');
    });
  }

  // ---------- store ----------

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  getSnapshot = () => this.snap;
  setRtc(rtc: RtcConfig) {
    this.rtc = rtc;
  }
  private set(patch: Partial<CallSnapshot>) {
    this.snap = { ...this.snap, ...patch };
    for (const l of this.listeners) l();
  }

  get busy() {
    return this.snap.status === 'outgoing' || this.snap.status === 'active';
  }

  // ---------- starting and joining ----------

  /** Starts a call in a conversation (or joins the one already going on there). */
  async start(conversationId: string, media: CallMedia, title: string): Promise<void> {
    if (this.busy) return;
    if (!(await this.prepare(conversationId, media, title))) return;
    const res = (await this.socket.emitWithAck('call:start', { conversationId, media })) as Ack<{ call: ActiveCall; existing: boolean }>;
    if (!res.ok) return this.fail('failed');
    if (res.existing) return this.enter(res.call.callId);
    this.set({ callId: res.call.callId, status: 'outgoing' });
  }

  /** Joins a ringing or running call. */
  async join(call: { callId: string; conversationId: string }, media: CallMedia, title: string): Promise<void> {
    if (this.busy) return;
    if (!(await this.prepare(call.conversationId, media, title))) return;
    await this.enter(call.callId);
  }

  private async enter(callId: string): Promise<void> {
    const res = (await this.socket.emitWithAck('call:join', { callId })) as Ack<{ call: ActiveCall; peers: CallPeer[] }>;
    if (!res.ok) return this.fail('failed');
    this.set({ callId, media: res.call.media });
    for (const peer of res.peers) {
      this.addPeer(peer);
      void this.connection(peer.peerId, true);
    }
    this.set({ status: res.peers.length ? 'active' : 'outgoing', connectedAt: res.peers.length ? Date.now() : null });
    this.announceMedia();
  }

  private async prepare(conversationId: string, media: CallMedia, title: string): Promise<boolean> {
    if (this.resetTimer) clearTimeout(this.resetTimer);
    this.snap = { ...IDLE, status: 'outgoing', conversationId, media, title, camera: media === 'video' };
    this.set({});
    if (typeof RTCPeerConnection === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      this.fail('unsupported');
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: media === 'video' ? { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } } : false,
      });
      this.audioTrack = stream.getAudioTracks()[0] ?? null;
      this.cameraTrack = stream.getVideoTracks()[0] ?? null;
    } catch {
      // Video refused or no camera: try audio only before giving up.
      try {
        if (media !== 'video') throw new Error('no audio');
        const audio = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.audioTrack = audio.getAudioTracks()[0] ?? null;
        this.cameraTrack = null;
      } catch {
        this.fail('mediaDenied');
        return false;
      }
    }
    this.set({ camera: !!this.cameraTrack, preview: this.previewStream() });
    return true;
  }

  // ---------- peer connections ----------

  private addPeer(peer: CallPeer) {
    if (this.snap.peers.some((p) => p.peerId === peer.peerId)) return;
    this.set({ peers: [...this.snap.peers, { ...peer, stream: null, mic: true, camera: false, screen: false, state: 'new' }] });
  }

  private patchPeer(peerId: string, patch: Partial<RemotePeer>) {
    this.set({ peers: this.snap.peers.map((p) => (p.peerId === peerId ? { ...p, ...patch } : p)) });
  }

  /** Creates the connection to one peer; the initiator adds both transceivers and sends the offer. */
  private async connection(peerId: string, initiator: boolean): Promise<RTCPeerConnection> {
    const existing = this.pcs.get(peerId);
    if (existing) return existing;
    const pc = new RTCPeerConnection({ iceServers: this.rtc.iceServers });
    this.pcs.set(peerId, pc);
    pc.onicecandidate = (e) => {
      if (!e.candidate) return;
      const json = e.candidate.toJSON();
      this.signal(peerId, { type: 'candidate', candidate: { ...json, candidate: json.candidate ?? '' } });
    };
    pc.ontrack = (e) => {
      const peer = this.snap.peers.find((p) => p.peerId === peerId);
      const stream = peer?.stream ?? new MediaStream();
      if (!stream.getTracks().includes(e.track)) stream.addTrack(e.track);
      this.patchPeer(peerId, { stream });
    };
    pc.onconnectionstatechange = () => {
      this.patchPeer(peerId, { state: pc.connectionState });
      if (pc.connectionState === 'failed') pc.restartIce();
    };
    if (initiator) {
      pc.addTransceiver(this.audioTrack ?? 'audio', { direction: 'sendrecv' });
      pc.addTransceiver(this.currentVideo() ?? 'video', { direction: 'sendrecv' });
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.signal(peerId, { type: 'offer', sdp: offer.sdp ?? '' });
    }
    return pc;
  }

  private async onSignal(from: string, data: CallSignal['data']) {
    if (data.type === 'offer') {
      const pc = await this.connection(from, false);
      await pc.setRemoteDescription({ type: 'offer', sdp: data.sdp });
      // Attach my tracks to the transceivers the offer created.
      for (const t of pc.getTransceivers()) {
        const kind = t.receiver.track.kind;
        t.direction = 'sendrecv';
        await t.sender.replaceTrack(kind === 'audio' ? this.audioTrack : this.currentVideo());
      }
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this.signal(from, { type: 'answer', sdp: answer.sdp ?? '' });
      await this.flush(from, pc);
    } else if (data.type === 'answer') {
      const pc = this.pcs.get(from);
      if (!pc) return;
      await pc.setRemoteDescription({ type: 'answer', sdp: data.sdp });
      await this.flush(from, pc);
    } else if (data.type === 'candidate') {
      const pc = this.pcs.get(from);
      if (pc?.remoteDescription) await pc.addIceCandidate(data.candidate).catch(() => undefined);
      else this.queued.set(from, [...(this.queued.get(from) ?? []), data.candidate]);
    }
  }

  private async flush(peerId: string, pc: RTCPeerConnection) {
    for (const c of this.queued.get(peerId) ?? []) await pc.addIceCandidate(c).catch(() => undefined);
    this.queued.delete(peerId);
  }

  private signal(to: string, data: CallSignal['data']) {
    if (this.snap.callId) this.socket.emit('call:signal', { callId: this.snap.callId, to, data });
  }

  // ---------- controls ----------

  toggleMic() {
    if (!this.audioTrack) return;
    this.audioTrack.enabled = !this.audioTrack.enabled;
    this.set({ mic: this.audioTrack.enabled });
    this.announceMedia();
  }

  async toggleCamera() {
    if (this.cameraTrack) {
      this.cameraTrack.stop();
      this.cameraTrack = null;
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } } });
        this.cameraTrack = stream.getVideoTracks()[0] ?? null;
      } catch {
        this.set({ error: 'mediaDenied' });
        return;
      }
    }
    await this.applyVideo();
    this.set({ camera: !!this.cameraTrack });
  }

  async toggleScreen() {
    if (this.screenTrack) return this.stopScreen();
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 15 } }, audio: false });
      this.screenTrack = stream.getVideoTracks()[0] ?? null;
      if (this.screenTrack) {
        this.screenTrack.contentHint = 'detail';
        this.screenTrack.onended = () => void this.stopScreen();
      }
    } catch {
      return; // the person closed the picker
    }
    await this.applyVideo();
    this.set({ screen: !!this.screenTrack });
  }

  private async stopScreen() {
    this.screenTrack?.stop();
    this.screenTrack = null;
    await this.applyVideo();
    this.set({ screen: false });
  }

  private currentVideo(): MediaStreamTrack | null {
    return this.screenTrack ?? this.cameraTrack;
  }

  private previewStream(): MediaStream | null {
    const track = this.currentVideo();
    return track ? new MediaStream([track]) : null;
  }

  /** Puts the current video (screen, camera or nothing) on every connection. */
  private async applyVideo() {
    const track = this.currentVideo();
    for (const pc of this.pcs.values()) {
      const t = pc.getTransceivers().find((x) => x.receiver.track.kind === 'video');
      if (t) await t.sender.replaceTrack(track).catch(() => undefined);
    }
    this.set({ preview: this.previewStream() });
    this.announceMedia();
  }

  private announceMedia() {
    if (!this.snap.callId) return;
    this.socket.emit('call:media', { callId: this.snap.callId, mic: this.audioTrack?.enabled ?? false, camera: !!this.cameraTrack, screen: !!this.screenTrack });
  }

  // ---------- ending ----------

  hangUp() {
    if (this.snap.callId) this.socket.emit('call:leave', { callId: this.snap.callId });
    this.finish('ended');
  }

  /** Clears an ended call's screen (or an error) right away. */
  dismiss() {
    if (this.resetTimer) clearTimeout(this.resetTimer);
    if (!this.busy) this.set({ ...IDLE });
  }

  private fail(error: CallError) {
    this.cleanup();
    this.set({ status: 'ended', error, endedReason: null });
    this.scheduleReset(4000);
  }

  private finish(reason: string) {
    this.cleanup();
    this.set({ status: 'ended', endedReason: reason, peers: [], preview: null });
    this.scheduleReset(1800);
  }

  private scheduleReset(ms: number) {
    if (this.resetTimer) clearTimeout(this.resetTimer);
    this.resetTimer = setTimeout(() => this.set({ ...IDLE }), ms);
  }

  private closePeer(peerId: string) {
    this.pcs.get(peerId)?.close();
    this.pcs.delete(peerId);
    this.queued.delete(peerId);
  }

  private cleanup() {
    for (const id of [...this.pcs.keys()]) this.closePeer(id);
    for (const t of [this.audioTrack, this.cameraTrack, this.screenTrack]) t?.stop();
    this.audioTrack = this.cameraTrack = this.screenTrack = null;
  }

  dispose() {
    if (this.busy) this.hangUp();
    for (const f of this.off) f();
    if (this.resetTimer) clearTimeout(this.resetTimer);
  }
}
