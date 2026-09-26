import type {
  ClientConnectionState,
  TestClientOptions,
  TestTransportAdapter,
  TestTransportConnection,
  WaitForMessageOptions,
} from "./types.js";

interface MessageWaiter<T> {
  predicate: (message: T) => boolean;
  resolve(message: T): void;
  reject(reason: Error): void;
  timer: ReturnType<typeof setTimeout>;
}

export class TestClient<TInbound = unknown, TOutbound = unknown> {
  readonly id: string;
  readonly options: TestClientOptions;
  #adapter: TestTransportAdapter<TInbound, TOutbound>;
  #connection: TestTransportConnection<TOutbound> | undefined;
  #inbox: TInbound[] = [];
  #waiters = new Set<MessageWaiter<TInbound>>();
  #state: ClientConnectionState = "idle";

  constructor(options: TestClientOptions, adapter: TestTransportAdapter<TInbound, TOutbound>) {
    this.id = options.clientId;
    this.options = options;
    this.#adapter = adapter;
  }

  get state(): ClientConnectionState { return this.#state; }

  async connect(): Promise<void> {
    if (this.#state === "disposed") throw new Error(`Cannot connect disposed test client "${this.id}"`);
    if (this.#state === "connected") return;
    this.#connection = await this.#adapter.connect(this.options, {
      onMessage: (message) => this.#receive(message),
      onClose: () => {
        this.#connection = undefined;
        if (this.#state !== "disposed") this.#state = "disconnected";
      },
    });
    this.#state = "connected";
  }

  async send(message: TOutbound): Promise<void> {
    if (this.#state !== "connected" || !this.#connection) {
      throw new Error(`Test client "${this.id}" is not connected`);
    }
    await this.#connection.send(message);
  }

  async disconnect(): Promise<void> {
    const connection = this.#connection;
    this.#connection = undefined;
    if (this.#state !== "disposed") this.#state = "disconnected";
    await connection?.close();
  }

  drainMessages(): TInbound[] { return this.#inbox.splice(0); }

  async waitForMessage(
    predicate: (message: TInbound) => boolean,
    options: WaitForMessageOptions = {},
  ): Promise<TInbound> {
    const existingIndex = this.#inbox.findIndex(predicate);
    if (existingIndex >= 0) return this.#inbox.splice(existingIndex, 1)[0]!;
    const timeoutMs = options.timeoutMs ?? 1_000;
    return new Promise<TInbound>((resolve, reject) => {
      const waiter: MessageWaiter<TInbound> = {
        predicate,
        resolve,
        reject,
        timer: setTimeout(() => {
          this.#waiters.delete(waiter);
          reject(new Error(
            `Client "${this.id}" timed out after ${timeoutMs}ms waiting for ${options.description ?? "message"}`,
          ));
        }, timeoutMs),
      };
      this.#waiters.add(waiter);
    });
  }

  async dispose(): Promise<void> {
    if (this.#state === "disposed") return;
    this.#state = "disposed";
    await this.disconnect();
    this.#state = "disposed";
    for (const waiter of this.#waiters) {
      clearTimeout(waiter.timer);
      waiter.reject(new Error(`Test client "${this.id}" was disposed`));
    }
    this.#waiters.clear();
    this.#inbox = [];
  }

  #receive(message: TInbound): void {
    for (const waiter of this.#waiters) {
      if (waiter.predicate(message)) {
        clearTimeout(waiter.timer);
        this.#waiters.delete(waiter);
        waiter.resolve(message);
        return;
      }
    }
    this.#inbox.push(message);
  }
}
