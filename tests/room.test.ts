import { describe, it, expect } from 'vitest';
import { RoomManager } from '../src/network/RoomManager';
import { GameMode } from '../src/types';

describe('Custom Room & 1v1 / 2v2 Modes', () => {
  it('should initialize 1v1 Duel Arena with 2 slots', () => {
    const manager = new RoomManager();
    const room = manager.createRoom(GameMode.DUEL_1V1);

    expect(room.mode).toBe(GameMode.DUEL_1V1);
    expect(room.slots.length).toBe(2);
    expect(room.slots[0].team).toBe('blue');
    expect(room.slots[0].isHuman).toBe(true);
    expect(room.slots[1].team).toBe('red');
    expect(room.slots[1].isHuman).toBe(false); // Bot rival by default
  });

  it('should initialize 2v2 Squad Clash with 4 slots', () => {
    const manager = new RoomManager();
    const room = manager.createRoom(GameMode.CLASH_2V2);

    expect(room.mode).toBe(GameMode.CLASH_2V2);
    expect(room.slots.length).toBe(4);

    const blueSlots = room.slots.filter(s => s.team === 'blue');
    const redSlots = room.slots.filter(s => s.team === 'red');

    expect(blueSlots.length).toBe(2);
    expect(redSlots.length).toBe(2);

    // Teammate slot is bot ally if not yet invited
    expect(blueSlots[1].name).toBe('Bot_Ally');
  });

  it('should toggle slot between bot and human invite', () => {
    const manager = new RoomManager();
    const room = manager.createRoom(GameMode.CLASH_2V2);

    // Toggle opponent slot 2 to open for human
    manager.toggleSlotBot(2);
    expect(room.slots[2].isHuman).toBe(true);

    // Toggle back to bot
    manager.toggleSlotBot(2);
    expect(room.slots[2].isHuman).toBe(false);
    expect(room.slots[2].name).toContain('Bot_');
  });

  it('should track team scores in clash mode', () => {
    const manager = new RoomManager();
    manager.createRoom(GameMode.CLASH_2V2, 5);

    manager.registerKill('blue');
    manager.registerKill('blue');
    manager.registerKill('red');

    expect(manager.teamBlueScore).toBe(2);
    expect(manager.teamRedScore).toBe(1);
  });

  it('should generate valid LAN Wi-Fi link with host IP', () => {
    const manager = new RoomManager();
    const room = manager.createRoom(GameMode.DUEL_1V1);
    const link = manager.getLocalNetworkLink('red');

    expect(link).toContain('192.168.1.66:3000');
    expect(link).toContain(room.roomId);
    expect(link).toContain('team=red');
    expect(link).toContain('mode=DUEL_1V1');
  });

  it('should generate valid public internet live link', () => {
    const manager = new RoomManager();
    const room = manager.createRoom(GameMode.CLASH_2V2);
    const link = manager.getPublicInternetLink('red');

    expect(link).toContain('https://');
    expect(link).toContain('github.io');
    expect(link).toContain(room.roomId);
  });

  it('should route DAMAGE_EVENT and PLAYER_ELIMINATED through onRemotePlayerUpdate', () => {
    const manager = new RoomManager();
    const receivedMessages: any[] = [];
    manager.onRemotePlayerUpdate = (data) => receivedMessages.push(data);

    // Simulate incoming messages via handleNetworkMessage
    (manager as any).handleNetworkMessage({
      type: 'DAMAGE_EVENT',
      targetSlot: 1,
      damage: 32,
      isHeadshot: false
    });

    (manager as any).handleNetworkMessage({
      type: 'PLAYER_ELIMINATED',
      slotId: 1,
      killerTeam: 'blue'
    });

    expect(receivedMessages.length).toBe(2);
    expect(receivedMessages[0].type).toBe('DAMAGE_EVENT');
    expect(receivedMessages[0].damage).toBe(32);
    expect(receivedMessages[1].type).toBe('PLAYER_ELIMINATED');
  });
});

