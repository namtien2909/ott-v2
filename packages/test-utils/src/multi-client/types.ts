export type ClientConnectionState = "idle" | "connected" | "disconnected" | "disposed";

export interface TestClientOptions {
  clientId: string;
  session?: Readonly<Record<string, string>>;
}

export interface TestTransportConnection<TOutbound> {
  send(message: TOutbound): void | Promise<void>;
  close(): void | Promise<void>;
}

export interface TestTransportCallbacks<TInbound> {
  onMessage(message: TInbound): void;
  onClose(reason?: unknown): void;
}

export interface TestTransportAdapter<TInbound, TOutbound> {
  connect(
    options: TestClientOptions,
    callbacks: TestTransportCallbacks<TInbound>,
  ): TestTransportConnection<TOutbound> | Promise<TestTransportConnection<TOutbound>>;
}

export type TestTransportAdapterFactory<TInbound, TOutbound> = (
  options: TestClientOptions,
) => TestTransportAdapter<TInbound, TOutbound>;

export interface WaitForMessageOptions {
  timeoutMs?: number;
  description?: string;
}
