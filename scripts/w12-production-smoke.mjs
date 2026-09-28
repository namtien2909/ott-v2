import process from "node:process";

const webUrl = (process.env.W12_WEB_URL || process.env.W12_API_URL || "http://127.0.0.1:3001").replace(/\/$/, "");
const apiUrl = (process.env.W12_API_URL || webUrl).replace(/\/$/, "");
const webOrigin = process.env.W12_WEB_ORIGIN || process.env.W12_WEB_URL || "http://localhost:3000";
const timeout = 10_000;

const canonicalRoutes = [
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/home",
  "/queue",
  "/room/ABC234",
  "/game/00000000-0000-4000-8000-000000000001",
  "/history",
  "/history/00000000-0000-4000-8000-000000000001",
  "/profile/demo",
  "/friends",
  "/settings",
  "/guest",
  "/guest/play",
  "/ai",
  "/offline",
  "/spectate/ABC234"
];

async function request(url, init = {}) {
  return fetch(url, { ...init, signal: AbortSignal.timeout(timeout) });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const webResults = [];
for (const route of canonicalRoutes) {
  const response = await request(`${webUrl}${route}`, { headers: { Accept: "text/html" } });
  const contentType = response.headers.get("content-type") || "";
  assert(response.status === 200, `web ${route}: expected 200, received ${response.status}`);
  assert(contentType.includes("text/html"), `web ${route}: expected HTML, received ${contentType}`);
  webResults.push({ route, status: response.status });
}

const health = await request(`${apiUrl}/health`, { headers: { Origin: webOrigin } });
assert(health.status === 200, `api /health: expected 200, received ${health.status}`);
const healthBody = await health.json();
assert(typeof healthBody.status === "string", "api /health: invalid status payload");

const metrics = await request(`${apiUrl}/diagnostics/metrics`, { headers: { Origin: webOrigin } });
assert(metrics.status === 200, `api /diagnostics/metrics: expected 200, received ${metrics.status}`);
const metricsBody = await metrics.json();
assert(typeof metricsBody.requestCount === "number", "api metrics: invalid requestCount payload");

const allowOrigin = health.headers.get("access-control-allow-origin");
assert(allowOrigin === webOrigin, `api CORS: expected ${webOrigin}, received ${allowOrigin || "<none>"}`);
assert(allowOrigin !== "*", "api CORS: wildcard origin is not allowed");

console.log(JSON.stringify({
  webUrl,
  apiUrl,
  webOrigin,
  routesChecked: webResults.length,
  apiHealth: { status: healthBody.status, httpStatus: health.status },
  metrics: { requestCount: metricsBody.requestCount, httpStatus: metrics.status },
  cors: allowOrigin,
  status: "PASS"
}, null, 2));
