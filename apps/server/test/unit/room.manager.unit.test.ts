import { describe, expect, it } from "vitest";

import { RoomManager, ROOM_ID_ALPHABET, type RoomActor } from "../../src/modules/room/room.manager.js";

const host: RoomActor = { userId: "u-host", username: "host_user", displayName: "Host" };
const guest: RoomActor = { userId: "u-guest", username: "guest_user", displayName: "Guest" };
const third: RoomActor = { userId: "u-third", username: "third_user", displayName: "Third" };
const publicInput = { name: "Public Test", visibility: "PUBLIC" as const, timerSeconds: 300 as const, spectatorsEnabled: false };

describe("W3 RoomManager", () => {
  it("generates safe IDs and keeps private rooms out of browse", async () => {
    const manager = new RoomManager();
    const publicRoom = await manager.create(host, publicInput, "create-public");
    const privateRoom = await manager.create(guest, { ...publicInput, name: "Private Test", visibility: "PRIVATE", password: "secret" }, "create-private");
    expect(publicRoom.roomId).toMatch(/^[A-Z2-9]{6}$/);
    expect([...publicRoom.roomId].every((character) => ROOM_ID_ALPHABET.includes(character))).toBe(true);
    expect(manager.list().map((room) => room.roomId)).toEqual([publicRoom.roomId]);
    expect(manager.search(privateRoom.roomId).requiresPassword).toBe(true);
    expect(manager.search(privateRoom.roomId).members).toEqual([]);
  });

  it("enforces private password and a two-player active capacity", async () => {
    const manager = new RoomManager();
    const room = await manager.create(host, { ...publicInput, visibility: "PRIVATE", password: "secret" });
    await expect(manager.join(guest, room.roomId, { password: "wrong" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    const joined = await manager.join(guest, room.roomId, { password: "secret" });
    expect(joined.players).toBe(2);
    await expect(manager.join(third, room.roomId, {})).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("makes create and join idempotent", async () => {
    const manager = new RoomManager();
    const first = await manager.create(host, publicInput, "same-create");
    const duplicateCreate = await manager.create(host, publicInput, "same-create");
    expect(duplicateCreate.roomId).toBe(first.roomId);
    expect(manager.size()).toBe(1);
    const firstJoin = await manager.join(guest, first.roomId, {}, "same-join");
    const duplicateJoin = await manager.join(guest, first.roomId, {}, "same-join");
    expect(duplicateJoin.roomId).toBe(firstJoin.roomId);
    expect(duplicateJoin.players).toBe(2);
    expect(manager.search(first.roomId, guest.userId).members).toHaveLength(2);
  });

  it("transfers host, retains waiting rooms and cleans up empty rooms", async () => {
    const manager = new RoomManager();
    const room = await manager.create(host, publicInput);
    await manager.join(guest, room.roomId, {});
    const afterGuestLeaves = manager.leave(guest, room.roomId);
    expect(afterGuestLeaves?.players).toBe(1);
    expect(afterGuestLeaves?.hostUserId).toBe(host.userId);
    await manager.join(guest, room.roomId, {});
    const afterHostLeaves = manager.leave(host, room.roomId);
    expect(afterHostLeaves?.hostUserId).toBe(guest.userId);
    expect(manager.search(room.roomId, guest.userId).members[0]?.isHost).toBe(true);
    expect(manager.leave(guest, room.roomId)).toBeNull();
    expect(manager.size()).toBe(0);
  });

  it("keeps Room A and Room B membership isolated", async () => {
    const manager = new RoomManager();
    const roomA = await manager.create(host, { ...publicInput, name: "Room A" });
    const roomB = await manager.create(guest, { ...publicInput, name: "Room B" });
    await manager.join(third, roomB.roomId, {});
    expect(manager.search(roomA.roomId, host.userId).members.map((member) => member.userId)).toEqual([host.userId]);
    expect(manager.search(roomB.roomId, guest.userId).members.map((member) => member.userId)).toEqual([guest.userId, third.userId]);
  });

  it("authorizes spectator access, exposes public players and enforces capacity", async () => {
    const manager = new RoomManager();
    const room = await manager.create(host, { ...publicInput, spectatorsEnabled: true, spectatorCapacity: 1 });
    await manager.join(guest, room.roomId, {});
    const spectatorRoom = await manager.spectate(third, room.roomId, {});
    expect(spectatorRoom.members).toHaveLength(2);
    expect(spectatorRoom.spectators).toBe(1);
    expect(manager.isSpectator(room.roomId, third.userId)).toBe(true);
    await expect(manager.spectate({ ...third, userId: "u-fourth" }, room.roomId, {})).rejects.toMatchObject({ details: { reason: "SPECTATOR_CAPACITY" } });
    manager.leaveSpectator(room.roomId, third.userId);
    expect(manager.isSpectator(room.roomId, third.userId)).toBe(false);
  });

  it("denies disabled/private spectator access and keeps players out of spectator role", async () => {
    const manager = new RoomManager();
    const disabled = await manager.create(host, publicInput);
    await manager.join(guest, disabled.roomId, {});
    await expect(manager.spectate(third, disabled.roomId, {})).rejects.toMatchObject({ details: { reason: "SPECTATOR_DISABLED" } });
    const privateHost = { ...third, userId: "u-private-host" };
    const privateRoom = await manager.create(privateHost, { ...publicInput, visibility: "PRIVATE", password: "secret", spectatorsEnabled: true, spectatorCapacity: 5 });
    await expect(manager.spectate(host, privateRoom.roomId, {})).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(manager.spectate(host, privateRoom.roomId, { password: "secret" })).resolves.toMatchObject({ spectators: 1 });
    await expect(manager.spectate(privateHost, privateRoom.roomId, { password: "secret" })).rejects.toMatchObject({ details: { reason: "SPECTATOR_PLAYER_CONFLICT" } });
  });
});
