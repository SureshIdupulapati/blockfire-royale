import { GameMode, RoomConfig, RoomSlot, Team } from '../types';

export class RoomManager {
  public currentRoom: RoomConfig | null = null;
  public localPlayerSlot: number = 0;
  public isHost: boolean = true;
  private channel: BroadcastChannel | null = null;

  public teamBlueScore: number = 0;
  public teamRedScore: number = 0;
  public onRoomUpdated: (room: RoomConfig) => void = () => {};
  public onScoreUpdated: (blueScore: number, redScore: number) => void = () => {};

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

  /**
   * Creates a new custom room with specified mode (1v1 or 2v2)
   */
  public createRoom(mode: GameMode = GameMode.CLASH_2V2, targetKills: number = 5): RoomConfig {
    const roomId = 'ROOM-' + Math.floor(1000 + Math.random() * 9000);
    this.isHost = true;
    this.localPlayerSlot = 0;

    const slots: RoomSlot[] = [];

    if (mode === GameMode.DUEL_1V1) {
      // Slot 0: Team Blue (Host)
      slots.push({
        slotId: 0,
        team: 'blue',
        name: 'Player 1 (You)',
        isHuman: true,
        isHost: true,
        isReady: true
      });
      // Slot 1: Team Red (Opponent)
      slots.push({
        slotId: 1,
        team: 'red',
        name: 'Bot_Viper',
        isHuman: false,
        isHost: false,
        isReady: true
      });
    } else if (mode === GameMode.CLASH_2V2) {
      // Team Blue
      slots.push({
        slotId: 0,
        team: 'blue',
        name: 'Player 1 (You)',
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

      // Team Red
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

    this.initP2PChannel(roomId);
    this.onRoomUpdated(this.currentRoom);
    return this.currentRoom;
  }

  /**
   * Joins an existing room by code or URL
   */
  public joinRoom(roomId: string, mode: GameMode = GameMode.CLASH_2V2, preferredTeam: Team = 'red'): void {
    this.isHost = false;
    this.initP2PChannel(roomId);

    // Ask host for current room state
    if (this.channel) {
      this.channel.postMessage({
        type: 'PLAYER_JOIN_REQUEST',
        payload: {
          name: 'Player 2 (Friend)',
          preferredTeam
        }
      });
    }

    // Temporary fallback if joining without open host tab
    if (!this.currentRoom) {
      this.currentRoom = this.createRoom(mode);
      this.currentRoom.roomId = roomId;
    }
  }

  private initP2PChannel(roomId: string): void {
    if (this.channel) {
      this.channel.close();
    }

    try {
      this.channel = new BroadcastChannel(`blockfire_${roomId}`);
      this.channel.onmessage = (event) => this.handleP2PMessage(event.data);
    } catch {
      // Fallback if BroadcastChannel is unavailable
    }
  }

  private handleP2PMessage(data: any): void {
    if (!data || !data.type) return;

    if (data.type === 'PLAYER_JOIN_REQUEST' && this.isHost && this.currentRoom) {
      // Host assigns joining player to empty or bot slot
      const req = data.payload;
      const targetTeam = req.preferredTeam || 'red';

      // Find first bot slot on requested team
      const slot = this.currentRoom.slots.find(s => s.team === targetTeam && !s.isHuman);
      if (slot) {
        slot.isHuman = true;
        slot.name = req.name || 'Friend';
        slot.isReady = true;

        this.broadcastRoomSync();
        this.onRoomUpdated(this.currentRoom);
      }
    } else if (data.type === 'ROOM_SYNC' && data.payload) {
      this.currentRoom = data.payload;
      this.onRoomUpdated(this.currentRoom!);
    } else if (data.type === 'SCORE_UPDATE') {
      this.teamBlueScore = data.payload.blue;
      this.teamRedScore = data.payload.red;
      this.onScoreUpdated(this.teamBlueScore, this.teamRedScore);
    }
  }

  public broadcastRoomSync(): void {
    if (this.channel && this.currentRoom) {
      this.channel.postMessage({
        type: 'ROOM_SYNC',
        payload: this.currentRoom
      });
    }
  }

  /**
   * Toggles a slot between human invite and AI bot
   */
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
   * Generates shareable invitation link for friends
   */
  public getInviteLink(team: Team = 'red'): string {
    if (typeof window === 'undefined') return '';
    if (!this.currentRoom) return window.location.href;
    const base = window.location.origin + window.location.pathname;
    return `${base}?room=${this.currentRoom.roomId}&mode=${this.currentRoom.mode}&team=${team}`;
  }

  /**
   * Records a kill for team scoring in 1v1 / 2v2
   */
  public registerKill(killerTeam: Team): { blueWins: boolean; redWins: boolean } {
    if (killerTeam === 'blue') {
      this.teamBlueScore++;
    } else {
      this.teamRedScore++;
    }

    if (this.channel) {
      this.channel.postMessage({
        type: 'SCORE_UPDATE',
        payload: { blue: this.teamBlueScore, red: this.teamRedScore }
      });
    }

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
