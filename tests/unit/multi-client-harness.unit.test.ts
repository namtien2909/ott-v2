import { afterEach, describe, expect, it } from "vitest";
import { MultiClientHarness, type TestTransportAdapter, type TestTransportCallbacks } from "../../packages/test-utils/src/index.js";

interface Message { type: string; value?: string; }

function createInspectableTransport() {
  const callbacks = new Map<string, TestTransportCallbacks<Message>>();
  const closed = new Set<string>();
  const adapterFor = (clientId: string): TestTransportAdapter<Message, Message> => ({
    connect: async (_options, clientCallbacks) => {
      callbacks.set(clientId, clientCallbacks);
      return {
        send: async () => undefined,
        close: async () => {
          if (closed.has(clientId)) return;
          closed.add(clientId);
          callbacks.delete(clientId);
          clientCallbacks.onClose();
        },
      };
    },
  });
  return {
    adapterFor,
    emit(clientId: string, message: Message) { callbacks.get(clientId)?.onMessage(message); },
    closed,
  };
}

describe("MultiClientHarness", () => {
  const activeHarnesses: MultiClientHarness<Message, Message>[] = [];
  afterEach(async () => {
    await Promise.all(activeHarnesses.splice(0).map((harness) => harness.dispose()));
  });

  it("isolates inboxes for independent clients", async () => {
    const transport = createInspectableTransport();
    const harness = new MultiClientHarness<Message, Message>(({ clientId }) => transport.adapterFor(clientId));
    activeHarnesses.push(harness);
    const alice = harness.createClient({ clientId: "alice" });
    const bob = harness.createClient({ clientId: "bob" });
    await Promise.all([alice.connect(), bob.connect()]);
    transport.emit("alice", { type: "notice", value: "private-to-alice" });
    await expect(alice.waitForMessage((message) => message.type === "notice")).resolves.toEqual({
      type: "notice", value: "private-to-alice",
    });
    expect(bob.drainMessages()).toEqual([]);
  });

  it("reports finite message timeouts with client context", async () => {
    const transport = createInspectableTransport();
    const harness = new MultiClientHarness<Message, Message>(({ clientId }) => transport.adapterFor(clientId));
    activeHarnesses.push(harness);
    const alice = harness.createClient({ clientId: "alice" });
    await alice.connect();
    await expect(alice.waitForMessage(() => true, { timeoutMs: 5, description: "WELCOME" }))
      .rejects.toThrow('Client "alice" timed out after 5ms waiting for WELCOME');
  });

  it("cleans up clients idempotently", async () => {
    const transport = createInspectableTransport();
    const harness = new MultiClientHarness<Message, Message>(({ clientId }) => transport.adapterFor(clientId));
    const alice = harness.createClient({ clientId: "alice" });
    await alice.connect();
    await harness.dispose();
    await harness.dispose();
    expect(alice.state).toBe("disposed");
    expect(transport.closed).toContain("alice");
    expect(harness.clients).toEqual([]);
  });
});
