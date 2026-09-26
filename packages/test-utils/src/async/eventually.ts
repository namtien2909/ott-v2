export interface EventuallyOptions {
  timeoutMs?: number;
  intervalMs?: number;
  description?: string;
}

export async function eventually(
  assertion: () => void | Promise<void>,
  options: EventuallyOptions = {},
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? 1_000;
  const intervalMs = options.intervalMs ?? 10;
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;

  do {
    try {
      await assertion();
      return;
    } catch (error) {
      lastError = error;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, intervalMs));
  } while (Date.now() < deadline);

  const detail = lastError instanceof Error ? `: ${lastError.message}` : "";
  throw new Error(
    `Timed out after ${timeoutMs}ms waiting for ${options.description ?? "assertion"}${detail}`,
    { cause: lastError },
  );
}
