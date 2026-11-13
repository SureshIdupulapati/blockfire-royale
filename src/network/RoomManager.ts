import { GameMode, RoomConfig, RoomSlot, Team } from '../types';
import { Peer, DataConnection } from 'peerjs';

export class RoomManager {
  public currentRoom: RoomConfig | null = null;
  public localPlayerSlot: number = 0;
  public isHost: boolean = true;
  public preferredTeam: Team = 'red';
  private channel: BroadcastChannel | null = null;
  private socket: WebSocket | null = null;
  private peer: Peer | null = null;
  private peerConnections: DataConnection[] = [];

  public teamBlueScore: number = 0;
  public teamRedScore: number = 0;
  public onRoomUpdated: (room: RoomConfig) => void = () => {};
  public onScoreUpdated: (blueScore: number, redScore: number) => void = () => {};
  public onStartMatch: (mode: GameMode) => void = () => {};
  public onRemotePlayerUpdate: (data: any) => void = () => {};

  public readonly localIP: string = '192.168.1.66';
  public readonly publicLiveHost: string = 'https://sureshidupulapati.github.io/blockfire-royale';

  constructor() {
    this.checkUrlForRoomInvite();
  }

  private checkUrlForRoomInvite(): void {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const roomId = params.get('room');
    const mode = (params.get('mode') as GameMode) || GameMode.DUEL_1V1;
    const teamParam = (params.get('team') as Team) || 'red';

    if (roomId) {
      this.joinRoom(roomId, mode, teamParam);
    }
  }

  public createRoom(mode: GameMode = GameMode.CLASH_2V2, targetKills: number = 5): RoomConfig {
    const roomId = 'ROOM-' + Math.floor(1000 + Math.random() * 9000);
    this.isHost = true;
    this.localPlayerSlot = 0;

    const slots: RoomSlot[] = [];

    if (mode === GameMode.DUEL_1V1) {
      slots.push({
        slotId: 0,
        team: 'blue',
        name: 'Player 1 (Host)',
        isHuman: true,
        isHost: true,
        isReady: true
      });
      slots.push({
        slotId: 1,
        team: 'red',
        name: 'Bot_Viper',
        isHuman: false,
        isHost: false,
        isReady: true
      });
    } else if (mode === GameMode.CLASH_2V2) {
      slots.push({
        slotId: 0,
        team: 'blue',
        name: 'Player 1 (Host)',
        isHuman: true,
        isHost: true,
        isReady: true
      });
      slots.push({
        slotId: 1,
        team: 'blue',
        name: 'Bot_Ally',
        isHuman: false,
        isHost: false,
        isReady: true
      });
      slots.push({
        slotId: 2,
        team: 'red',
        name: 'Bot_Viper',
        isHuman: false,
        isHost: false,
        isReady: true
      });
      slots.push({
        slotId: 3,
        team: 'red',
        name: 'Bot_Ghost',
        isHuman: false,
        isHost: false,
        isReady: true
      });
    }

    this.currentRoom = {
      roomId,
      mode,
      targetKills,
      autoFillBots: true,
      slots
    };

    this.initNetworking(roomId);
    this.onRoomUpdated(this.currentRoom);
    return this.currentRoom;
  }

  public joinRoom(roomId: string, mode: GameMode = GameMode.CLASH_2V2, preferredTeam: Team = 'red'): void {
    this.isHost = false;
    this.preferredTeam = preferredTeam;
    this.initNetworking(roomId);

    // Send join request via WebSocket and BroadcastChannel
    const joinMsg = {
      type: 'PLAYER_JOIN_REQUEST',
      roomId,
      payload: {
        name: 'Player 2 (Friend)',
        preferredTeam
      }
    };

    this.sendNetworkMessage(joinMsg);

    if (!this.currentRoom) {
      this.currentRoom = this.createRoom(mode);
      this.currentRoom.roomId = roomId;
    }
  }

  private initNetworking(roomId: string): void {
    // 1. BroadcastChannel (for local tab testing)
    if (this.channel) {
      this.channel.close();
    }
    try {
      this.channel = new BroadcastChannel(`blockfire_${roomId}`);
      this.channel.onmessage = (event) => this.handleNetworkMessage(event.data);
    } catch {
      // BroadcastChannel optional fallback
    }

    // 2. WebRTC PeerJS Connection (works globally on GitHub Pages & across PCs)
    this.initPeerNetworking(roomId);

    // 3. WebSocket Server Connection (for local Vite dev server)
    if (typeof window !== 'undefined' && (window.location.host.includes('localhost') || window.location.host.includes('192.168.'))) {
      if (this.socket) {
        this.socket.close();
      }

      try {
        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        this.socket = new WebSocket(`${proto}//${host}/api/multiplayer`);

        this.socket.onopen = () => {
          this.socket?.send(JSON.stringify({
            type: 'JOIN_ROOM',
            roomId
          }));

          if (!this.isHost) {
            this.socket?.send(JSON.stringify({
              type: 'PLAYER_JOIN_REQUEST',
              roomId,
              payload: {
                name: 'Player 2 (Friend)',
                preferredTeam: this.preferredTeam
              }
            }));
          }
        };

        this.socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleNetworkMessage(data);
          } catch (e) {
            console.error('WS parse error:', e);
          }
        };
      } catch (e) {
        console.warn('WebSocket connection not supported in current environment', e);
      }
    }
  }

  private initPeerNetworking(roomId: string): void {
    if (typeof window === 'undefined') return;

    if (this.peer) {
      try { this.peer.destroy(); } catch {}
      this.peer = null;
    }
    this.peerConnections = [];

    const safeId = roomId.toLowerCase().replace(/[^a-z0-9_-]/g, '');

    try {
      if (this.isHost) {
        const hostPeerId = `bf-${safeId}-host`;
        this.peer = new Peer(hostPeerId);

        this.peer.on('connection', (conn) => {
          this.peerConnections.push(conn);
          this.updateConnectionStatus('🟢 FRIEND CONNECTED!');

          conn.on('open', () => {
            if (this.currentRoom) {
              conn.send({ type: 'ROOM_SYNC', payload: this.currentRoom });
            }
          });

          conn.on('data', (data) => {
            this.handleNetworkMessage(data);
          });

          conn.on('close', () => {
            this.peerConnections = this.peerConnections.filter(c => c !== conn);
            this.updateConnectionStatus('🟡 FRIEND DISCONNECTED');
          });
        });

        this.peer.on('error', (err) => {
          console.warn('PeerJS host info:', err);
        });
      } else {
        this.peer = new Peer();

        this.peer.on('open', () => {
          const hostPeerId = `bf-${safeId}-host`;
          const conn = this.peer!.connect(hostPeerId, { reliable: true });
          this.peerConnections.push(conn);

          conn.on('open', () => {
            this.updateConnectionStatus('🟢 CONNECTED TO HOST!');
            conn.send({
              type: 'PLAYER_JOIN_REQUEST',
              roomId,
              payload: {
                name: 'Player 2 (Friend)',
                preferredTeam: this.preferredTeam
              }
            });
          });

          conn.on('data', (data) => {
            this.handleNetworkMessage(data);
          });

          conn.on('close', () => {
            this.peerConnections = this.peerConnections.filter(c => c !== conn);
            this.updateConnectionStatus('🔴 DISCONNECTED');
          });
        });

        this.peer.on('error', (err) => {
          console.warn('PeerJS client info:', err);
        });
      }
    } catch (e) {
      console.warn('PeerJS init failed:', e);
    }
  }

  private updateConnectionStatus(text: string): void {
    if (typeof document !== 'undefined') {
      const el = document.getElementById('room-conn-status');
      if (el) el.innerText = text;
    }
  }

  public sendNetworkMessage(data: any): void {
    if (this.channel) {
      try { this.channel.postMessage(data); } catch {}
    }
    if (this.socket) {
      if (this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify(data));
      } else if (this.socket.readyState === WebSocket.CONNECTING) {
        this.socket.addEventListener('open', () => {
          this.socket?.send(JSON.stringify(data));
        }, { once: true });
      }
    }
    for (const conn of this.peerConnections) {
      if (conn && conn.open) {
        try { conn.send(data); } catch {}
      }
    }
  }

  private handleNetworkMessage(data: any): void {
    if (!data || !data.type) return;

    if (data.type === 'PLAYER_JOIN_REQUEST' && this.isHost && this.currentRoom) {
      const req = data.payload;
      const targetTeam = req.preferredTeam || 'red';

      const slot = this.currentRoom.slots.find(s => s.team === targetTeam && !s.isHuman);
      if (slot) {
        slot.isHuman = true;
        slot.name = req.name || 'Friend (Online)';
        slot.isReady = true;

        this.broadcastRoomSync();
        this.onRoomUpdated(this.currentRoom);
      }
    } else if (data.type === 'JOIN_ROOM' && this.isHost && this.currentRoom) {
      this.broadcastRoomSync();
    } else if (data.type === 'ROOM_SYNC' && data.payload) {
      this.currentRoom = data.payload;
      if (!this.isHost) {
        const mySlot = this.currentRoom?.slots.find(s => s.team === this.preferredTeam && s.isHuman && !s.isHost);
        if (mySlot) {
          this.localPlayerSlot = mySlot.slotId;
        }
      }
      this.onRoomUpdated(this.currentRoom!);
    } else if (data.type === 'START_MATCH') {
      this.onStartMatch(data.mode);
    } else if (data.type === 'PLAYER_STATE') {
      this.onRemotePlayerUpdate(data);
    } else if (data.type === 'SCORE_UPDATE') {
      this.teamBlueScore = data.payload.blue;
      this.teamRedScore = data.payload.red;
      this.onScoreUpdated(this.teamBlueScore, this.teamRedScore);
    }
  }

  public broadcastRoomSync(): void {
    if (this.currentRoom) {
      this.sendNetworkMessage({
        type: 'ROOM_SYNC',
        payload: this.currentRoom
      });
    }
  }

  public toggleSlotBot(slotId: number): void {
    if (!this.currentRoom || !this.isHost) return;
    const slot = this.currentRoom.slots.find(s => s.slotId === slotId);
    if (!slot || slot.isHost) return;

    slot.isHuman = !slot.isHuman;
    if (!slot.isHuman) {
      slot.name = slot.team === 'blue' ? 'Bot_Ally' : `Bot_${slot.slotId % 2 === 0 ? 'Viper' : 'Ghost'}`;
    } else {
      slot.name = 'Open (Invite Friend)';
    }

    this.broadcastRoomSync();
    this.onRoomUpdated(this.currentRoom);
  }

  /**
   * Generates the LAN Wi-Fi network link for another PC on the same Wi-Fi/network
   */
  public getLocalNetworkLink(team: Team = 'red'): string {
    if (!this.currentRoom) return '';
    return `http://${this.localIP}:3000/?room=${this.currentRoom.roomId}&mode=${this.currentRoom.mode}&team=${team}`;
  }

  /**
   * Generates the public HTTPS internet link for a friend playing from another location
   */
  public getPublicInternetLink(team: Team = 'red'): string {
    if (!this.currentRoom) return '';
    return `${this.publicLiveHost}/?room=${this.currentRoom.roomId}&mode=${this.currentRoom.mode}&team=${team}`;
  }

  /**
   * Default invite link generator:
   * - On GitHub Pages: uses official live URL
   * - On Localhost: replaces localhost with LAN Wi-Fi IP
   */
  public getInviteLink(team: Team = 'red'): string {
    if (typeof window === 'undefined') return '';
    if (!this.currentRoom) return window.location.href;

    if (!window.location.host.includes('localhost') && !window.location.host.includes('127.0.0.1')) {
      const base = window.location.origin + window.location.pathname;
      return `${base}?room=${this.currentRoom.roomId}&mode=${this.currentRoom.mode}&team=${team}`;
    }

    const proto = window.location.protocol;
    return `${proto}//${this.localIP}:3000/?room=${this.currentRoom.roomId}&mode=${this.currentRoom.mode}&team=${team}`;
  }

  public registerKill(killerTeam: Team): { blueWins: boolean; redWins: boolean } {
    if (killerTeam === 'blue') {
      this.teamBlueScore++;
    } else {
      this.teamRedScore++;
    }

    this.sendNetworkMessage({
      type: 'SCORE_UPDATE',
      payload: { blue: this.teamBlueScore, red: this.teamRedScore }
    });

    this.onScoreUpdated(this.teamBlueScore, this.teamRedScore);

    const target = this.currentRoom?.targetKills || 5;
    return {
      blueWins: this.teamBlueScore >= target,
      redWins: this.teamRedScore >= target
    };
  }

  public resetScores(): void {
    this.teamBlueScore = 0;
    this.teamRedScore = 0;
    this.onScoreUpdated(0, 0);
  }
}
