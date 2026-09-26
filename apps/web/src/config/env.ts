const rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

export const env = {
  apiBaseUrl: (rawApiBaseUrl || "http://localhost:3001").replace(/\/$/, ""),
} as const;
