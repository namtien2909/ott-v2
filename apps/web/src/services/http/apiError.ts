export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly code = "NETWORK_ERROR",
  ) { super(message); this.name = "ApiError"; }
}
