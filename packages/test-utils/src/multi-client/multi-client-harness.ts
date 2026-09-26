import { TestClient } from "./test-client.js";
import type { TestClientOptions, TestTransportAdapterFactory } from "./types.js";

export class MultiClientHarness<TInbound = unknown, TOutbound = unknown> {
  #adapterFactory: TestTransportAdapterFactory<TInbound, TOutbound>;
  #clients = new Map<string, TestClient<TInbound, TOutbound>>();
  #disposed = false;

  constructor(adapterFactory: TestTransportAdapterFactory<TInbound, TOutbound>) {
    this.#adapterFactory = adapterFactory;
  }

  get clients(): readonly TestClient<TInbound, TOutbound>[] { return [...this.#clients.values()]; }

  createClient(options: TestClientOptions): TestClient<TInbound, TOutbound> {
    if (this.#disposed) throw new Error("Cannot create a client on a disposed harness");
    if (this.#clients.has(options.clientId)) throw new Error(`Duplicate test client id "${options.clientId}"`);
    const client = new TestClient(options, this.#adapterFactory(options));
    this.#clients.set(options.clientId, client);
    return client;
  }

  async disconnectAll(): Promise<void> {
    await Promise.all(this.clients.map((client) => client.disconnect()));
  }

  async dispose(): Promise<void> {
    if (this.#disposed) return;
    this.#disposed = true;
    await Promise.all(this.clients.map((client) => client.dispose()));
    this.#clients.clear();
  }
}
