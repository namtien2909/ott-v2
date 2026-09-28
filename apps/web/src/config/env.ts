const rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
const defaultApiBaseUrl = import.meta.env.PROD ? "" : "http://localhost:3001";

export const env = {
  apiBaseUrl: (rawApiBaseUrl || defaultApiBaseUrl).replace(/\/$/, ""),
} as const;
