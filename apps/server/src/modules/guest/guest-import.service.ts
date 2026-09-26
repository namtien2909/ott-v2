import type { Prisma, PrismaClient } from "@prisma/client";
import type { GuestHistoryImportResponse, GuestMatchRecord } from "@ottv2/contracts";

import { AppError } from "../../shared/errors/app-error.js";

export function dedupeGuestRecords(records: readonly GuestMatchRecord[]): GuestMatchRecord[] {
  const unique = new Map<string, GuestMatchRecord>();
  for (const record of records) unique.set(record.localId, record);
  return [...unique.values()];
}

function unavailable(): never {
  throw new AppError("SERVICE_UNAVAILABLE", "Dịch vụ đồng bộ guest hiện chưa sẵn sàng.", 503, true, "RECOVERABLE");
}

export class GuestImportService {
  constructor(private readonly db?: PrismaClient) {}

  private requireDb(): PrismaClient {
    if (!this.db) unavailable();
    return this.db;
  }

  async import(userId: string, records: readonly GuestMatchRecord[]): Promise<GuestHistoryImportResponse> {
    const db = this.requireDb();
    const unique = dedupeGuestRecords(records);
    if (unique.length === 0) return { importedCount: 0, skippedCount: 0 };
    const localIds = unique.map((record) => record.localId);
    const existing = await db.guestHistoryImport.findMany({ where: { userId, localId: { in: localIds } }, select: { localId: true } });
    const existingIds = new Set(existing.map((row) => row.localId));
    const fresh = unique.filter((record) => !existingIds.has(record.localId));
    if (fresh.length > 0) {
      await db.guestHistoryImport.createMany({
        data: fresh.map((record) => ({ userId, localId: record.localId, payload: record as unknown as Prisma.InputJsonValue })),
        skipDuplicates: true,
      });
    }
    return { importedCount: fresh.length, skippedCount: unique.length - fresh.length };
  }
}
