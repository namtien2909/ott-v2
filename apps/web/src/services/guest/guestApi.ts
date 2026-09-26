import type { GuestHistoryImportResponse, GuestMatchRecord } from "@ottv2/contracts";
import { requestJson } from "../http/httpClient";

export function importGuestHistory(records: GuestMatchRecord[]) {
  return requestJson<GuestHistoryImportResponse>("/guest/history/import", { method: "POST", body: { records } });
}
