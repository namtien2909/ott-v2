import { AppError } from "../../shared/errors/app-error.js";

type Bucket = { failures: number; blockedUntil: number };

export class AuthThrottle {
  private readonly buckets = new Map<string, Bucket>();

  guard(key: string): void {
    const bucket = this.buckets.get(key);
    if (!bucket) return;
    const remaining = bucket.blockedUntil - Date.now();
    if (remaining <= 0) return;
    throw new AppError("RATE_LIMITED", "Có quá nhiều lần thử. Vui lòng thử lại sau.", 429, true, "RECOVERABLE", {
      retryAfterSeconds: Math.ceil(remaining / 1000),
    });
  }

  failure(key: string): void {
    const current = this.buckets.get(key) ?? { failures: 0, blockedUntil: 0 };
    const failures = current.failures + 1;
    const delay = failures >= 6 ? 30_000 : failures >= 4 ? 5_000 : failures >= 3 ? 1_000 : 0;
    this.buckets.set(key, { failures, blockedUntil: Date.now() + delay });
  }

  success(key: string): void {
    this.buckets.delete(key);
  }
}
