import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { createServer } from "node:http";
import { access, readFile, stat } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describeRuntimeStartup } from "./r3-runtime-startup.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");
const manifestPath = resolve(repoRoot, "docs/r3-bot-limit-manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const artifactManifest = JSON.parse(await readFile(resolve(repoRoot, "docs/r3-runtime-artifacts.json"), "utf8"));
const limits = manifest.limits;
const cliArgs = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const key = process.argv[index];
  if (key.startsWith("--")) cliArgs.set(key, process.argv[index + 1]);
}

const wasmtimePath = cliArgs.get("--wasmtime") ?? process.env.R3_WASMTIME;
const cpythonDir = cliArgs.get("--cpython-dir") ?? process.env.R3_CPYTHON_DIR;
const outsideSentinelPath = cliArgs.get("--outside-sentinel") ?? process.env.R3_OUTSIDE_SENTINEL;
const readonlyProbeFile = cliArgs.get("--readonly-probe-file") ?? process.env.R3_READONLY_PROBE_FILE;
const expectedWasmtimeSha256 = cliArgs.get("--wasmtime-sha256") ?? artifactManifest.artifacts?.wasmtime?.binarySha256;
const requirePass = process.argv.includes("--require-pass");

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function sha256(path) {
  const hash = createHash("sha256");
  await new Promise((resolvePromise, reject) => {
    const stream = createReadStream(path);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", resolvePromise);
  });
  return hash.digest("hex");
}

function missingReport(reason) {
  return {
    measuredAt: new Date().toISOString(),
    runtimeGate: "NOT_PROVEN",
    reason,
    fixtureCodeExecuted: false,
    playerCodeExecuted: false,
    checks: {},
  };
}

const artifactHashMismatches = [];
if (wasmtimePath && cpythonDir && (await exists(wasmtimePath)) && (await exists(resolve(cpythonDir, "python.wasm")))) {
  const expectedCpythonSha256 = artifactManifest.artifacts?.cpythonWasi?.wasmSha256;
  const [actualWasmtimeSha256, actualCpythonSha256] = await Promise.all([sha256(wasmtimePath), sha256(resolve(cpythonDir, "python.wasm"))]);
  if (!expectedWasmtimeSha256 || actualWasmtimeSha256.toLowerCase() !== expectedWasmtimeSha256.toLowerCase()) {
    artifactHashMismatches.push({ artifact: "wasmtime.exe", expectedSha256: expectedWasmtimeSha256 ?? null, actualSha256: actualWasmtimeSha256 });
  }
  if (!expectedCpythonSha256 || actualCpythonSha256.toLowerCase() !== expectedCpythonSha256.toLowerCase()) {
    artifactHashMismatches.push({ artifact: "python.wasm", expectedSha256: expectedCpythonSha256 ?? null, actualSha256: actualCpythonSha256 });
  }
}

if (!wasmtimePath || !cpythonDir || !(await exists(wasmtimePath)) || !(await exists(resolve(cpythonDir, "python.wasm")))) {
  console.log(JSON.stringify(missingReport("Provide --wasmtime and --cpython-dir for the pinned CPython-WASI/Wasmtime probe."), null, 2));
  if (requirePass) process.exitCode = 2;
} else if (artifactHashMismatches.length > 0) {
  console.log(JSON.stringify({
    ...missingReport("Pinned runtime artifact hash mismatch; no guest process was started."),
    artifactHashMismatches,
  }, null, 2));
  if (requirePass) process.exitCode = 3;
} else {
  const runtimeWasm = resolve(cpythonDir, "python.wasm");
  const runtimeStat = await stat(runtimeWasm);
  let outsideSentinelExists = false;
  let outsideSentinelOutsideRuntime = false;
  let guestSentinelPath = null;
  let readonlyProbeExists = false;
  let readonlyProbeGuestPath = null;
  if (outsideSentinelPath) {
    try {
      const sentinelAbsolute = resolve(outsideSentinelPath);
      outsideSentinelExists = (await stat(sentinelAbsolute)).size > 0;
      const relativeSentinel = relative(resolve(cpythonDir), sentinelAbsolute);
      outsideSentinelOutsideRuntime = relativeSentinel.startsWith("..") || relativeSentinel.startsWith("\\") || relativeSentinel.startsWith("/");
      if (outsideSentinelOutsideRuntime) guestSentinelPath = `/${relativeSentinel.split("\\").join("/")}`;
    } catch {
      outsideSentinelExists = false;
    }
  }
  if (readonlyProbeFile) {
    try {
      const probeAbsolute = resolve(readonlyProbeFile);
      readonlyProbeExists = (await stat(probeAbsolute)).size > 0;
      const relativeProbe = relative(resolve(cpythonDir), probeAbsolute);
      const probeIsInsideRuntime = relativeProbe !== "" && !relativeProbe.startsWith("..") && !relativeProbe.startsWith("\\") && !relativeProbe.startsWith("/");
      if (probeIsInsideRuntime) readonlyProbeGuestPath = `/${relativeProbe.split("\\").join("/")}`;
    } catch {
      readonlyProbeExists = false;
    }
  }
  const maxCaptureBytes = Math.max(limits.outputBytes * 4, 65536);

  function runGuest(source, options = {}) {
    const fuel = options.fuel ?? limits.wasmStartupFuel ?? limits.wasmFuel;
    const timeoutMs = options.timeoutMs ?? limits.perTurnMs;
    const hostTimeoutMs = options.hostTimeoutMs ?? Math.max(timeoutMs + 1500, 2000);
    const maxMemoryBytes = options.maxMemoryBytes ?? limits.wasmMemoryPages * 64 * 1024;
    const outputLimit = options.outputLimit ?? limits.outputBytes;
    const args = [
      "run",
      "--dir",
      ".::/",
      "-W",
      `fuel=${fuel}`,
      "-W",
      `timeout=${timeoutMs}ms`,
      "--env",
      "PYTHONHASHSEED=0",
      "--env",
      "TZ=UTC",
    ];
    if (maxMemoryBytes !== undefined) args.push("-W", `max-memory-size=${maxMemoryBytes}`, "-W", "trap-on-grow-failure=y");
    args.push("python.wasm", "-c", source);

    return new Promise((resolvePromise) => {
      const startedAt = performance.now();
      const child = spawn(wasmtimePath, args, {
        cwd: cpythonDir,
        env: {
          PATH: process.env.PATH ?? "",
          SystemRoot: process.env.SystemRoot ?? "",
          PYTHONHASHSEED: "0",
          TZ: "UTC",
          RAYON_NUM_THREADS: "1",
        },
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
      const stdoutChunks = [];
      const stderrChunks = [];
      let capturedBytes = 0;
      let cancelled = false;
      let hostTimedOut = false;
      let outputExceeded = false;
      let settled = false;
      let cancelTimer;
      let hostTimer;

      const append = (chunks, chunk) => {
        const buffer = Buffer.from(chunk);
        capturedBytes += buffer.byteLength;
        if (chunks.reduce((total, item) => total + item.byteLength, 0) < maxCaptureBytes) chunks.push(buffer.subarray(0, maxCaptureBytes));
        if (capturedBytes > outputLimit && !outputExceeded) {
          outputExceeded = true;
          child.kill();
        }
      };
      const finish = (code, signal, error = null) => {
        if (settled) return;
        settled = true;
        clearTimeout(cancelTimer);
        clearTimeout(hostTimer);
        resolvePromise({
          code,
          signal,
          cancelled,
          hostTimedOut,
          outputExceeded,
          elapsedMs: Math.round(performance.now() - startedAt),
          stdout: Buffer.concat(stdoutChunks).toString("utf8").slice(0, maxCaptureBytes),
          stderr: Buffer.concat(stderrChunks).toString("utf8").slice(0, maxCaptureBytes),
          outputBytes: capturedBytes,
          error: error ? String(error) : null,
        });
      };
      child.stdout.on("data", (chunk) => append(stdoutChunks, chunk));
      child.stderr.on("data", (chunk) => append(stderrChunks, chunk));
      child.once("error", (error) => finish(null, null, error));
      child.once("close", (code, signal) => finish(code, signal));

      if (options.cancelAfterMs !== undefined) {
        cancelTimer = setTimeout(() => {
          cancelled = true;
          child.kill();
        }, options.cancelAfterMs);
      }
      hostTimer = setTimeout(() => {
        hostTimedOut = true;
        child.kill();
      }, hostTimeoutMs);
    });
  }

  const abiSource = "import json\nstate = {'turn': 'BLUE', 'legalMoves': [{'from': 'a1', 'to': 'b2'}]}\nmemory = {'seen': 1}\ndef choose_move(state, memory):\n    return {'move': state['legalMoves'][0], 'memory': memory}\nprint(json.dumps(choose_move(state, memory), separators=(',', ':')))";
  const deterministicSource = "state = {'legalMoves': [{'from': 'a1', 'to': 'b2'}, {'from': 'a1', 'to': 'a2'}]}\ndef choose_move(seed, state):\n    index = seed % len(state['legalMoves'])\n    move = state['legalMoves'][index]\n    return str(seed) + ':' + move['from'] + '>' + move['to']\nprint(choose_move(42, state))";
  const alternateDeterministicSource = deterministicSource.replace("choose_move(42, state)", "choose_move(43, state)");
  // The whole-match fixture must exercise the SDK-shaped entry point, state,
  // legal-move validation and persistent memory on every turn.  It stays in
  // one guest process so that the 30s whole-match budget is measurable on a
  // free-class host; per-turn process startup is measured independently above.
  const wholeMatchSource = (side) => `import json, time
SIDE = '${side}'
ROUND_LIMIT = 60
state = {'turn': SIDE, 'ply': 0, 'legalMoves': [{'from': 'a1', 'to': 'b2'}, {'from': 'a1', 'to': 'a2'}], 'history': []}
memory = {'seen': 0, 'last': None}
turns = []
def choose_move(current_state, current_memory):
    legal_moves = current_state['legalMoves']
    index = (current_state['ply'] + (0 if SIDE == 'BLUE' else 1)) % len(legal_moves)
    move = legal_moves[index]
    return {'move': move, 'memory': {'seen': current_memory['seen'] + 1, 'last': move['to']}}
for _ in range(ROUND_LIMIT):
    started = time.perf_counter()
    result = choose_move(state, memory)
    if result['move'] not in state['legalMoves']:
        raise RuntimeError('illegal fixture move')
    memory = result['memory']
    state['history'].append(result['move'])
    state['ply'] += 1
    turns.append({'ply': state['ply'], 'elapsedUs': round((time.perf_counter() - started) * 1000000), 'memorySeen': memory['seen']})
print(json.dumps({'side': SIDE, 'turns': turns, 'statePly': state['ply'], 'memorySeen': memory['seen']}, separators=(',', ':')))`;
  const wholeMatchBlueSource = wholeMatchSource("BLUE");
  const wholeMatchRedSource = wholeMatchSource("RED");
  const boundedSource = "while True:\n    pass";

  const abi = await runGuest(abiSource);
  let abiValue = null;
  try {
    abiValue = JSON.parse(abi.stdout.trim());
  } catch {
    abiValue = null;
  }
  const abiPass = abi.code === 0 && abiValue?.move?.from === "a1" && abiValue?.move?.to === "b2" && abiValue?.memory?.seen === 1;

  const guestSentinelLiteral = JSON.stringify(guestSentinelPath);
  const envAndFiles = await runGuest(`import json, os\nresult = {'env': sorted(os.environ), 'secret': os.environ.get('DATABASE_URL')}\ntry:\n    open(${guestSentinelLiteral}, 'rb')\n    result['file'] = 'readable'\nexcept Exception as error:\n    result['file'] = type(error).__name__\ntry:\n    open('/lib/python3.14/__ott_v2_write_probe__', 'wb')\n    result['write'] = 'writable'\nexcept Exception as error:\n    result['write'] = type(error).__name__\nprint(json.dumps(result, separators=(',', ':'))) `);
  let envValue = null;
  try {
    envValue = JSON.parse(envAndFiles.stdout.trim());
  } catch {
    envValue = null;
  }
  const environmentPass = envAndFiles.code === 0 && Array.isArray(envValue?.env) && envValue.env.length === 2 && envValue.env.includes("PYTHONHASHSEED") && envValue.env.includes("TZ") && envValue.secret === null;
  const filesystemPass = outsideSentinelExists && outsideSentinelOutsideRuntime && guestSentinelPath !== null && envAndFiles.code === 0 && envValue?.file === "PermissionError" && envValue?.write === "PermissionError";

  const network = await runGuest("import socket\nsocket.socket()", { fuel: 10_000_000_000, timeoutMs: 1000, hostTimeoutMs: 3000 });
  const networkPass = network.code !== 0 && /not supported/i.test(`${network.stdout}\n${network.stderr}`);

  const pathTraversal = await runGuest(`import json\npaths = [${guestSentinelLiteral}, '/../../Windows/System32/drivers/etc/hosts', '/tmp/ott-v2-host-secret.txt']\nresults = []\nfor path in paths:\n    try:\n        open(path, 'rb')\n        results.append('readable')\n    except Exception as error:\n        results.append(type(error).__name__)\nprint(json.dumps(results, separators=(',', ':'))) `);
  let pathValue = null;
  try {
    pathValue = JSON.parse(pathTraversal.stdout.trim());
  } catch {
    pathValue = null;
  }
  const pathTraversalPass = outsideSentinelExists && outsideSentinelOutsideRuntime && guestSentinelPath !== null && pathTraversal.code === 0 && Array.isArray(pathValue) && pathValue[0] === "PermissionError" && pathValue[1] === "PermissionError" && pathValue[2] === "FileNotFoundError";

  const readonlyProbeLiteral = JSON.stringify(readonlyProbeGuestPath);
  const readonlyMutations = await runGuest(`import json, os\npath = ${readonlyProbeLiteral}\nresult = {}\ntry:\n    os.unlink(path)\n    result['unlink'] = 'succeeded'\nexcept Exception as error:\n    result['unlink'] = type(error).__name__\ntry:\n    os.rename(path, path + '.renamed')\n    result['rename'] = 'succeeded'\nexcept Exception as error:\n    result['rename'] = type(error).__name__\nprint(json.dumps(result, separators=(',', ':'))) `);
  let readonlyMutationValue = null;
  try { readonlyMutationValue = JSON.parse(readonlyMutations.stdout.trim()); } catch { readonlyMutationValue = null; }
  const readonlyMutationPass = readonlyProbeExists && readonlyProbeGuestPath !== null && readonlyMutations.code === 0 && readonlyMutationValue?.unlink === "PermissionError" && readonlyMutationValue?.rename === "PermissionError";

  const bounded = await runGuest(boundedSource, { fuel: limits.wasmFuel, timeoutMs: limits.perTurnMs, hostTimeoutMs: 3000 });
  const boundedPass = bounded.code !== 0 && /fuel|timed out|timeout|interrupt/i.test(`${bounded.stdout}\n${bounded.stderr}`);

  // Prove independent per-turn enforcement/reset, separate from the
  // SDK-shaped in-process whole-match compatibility fixture.
  const quotaTimeoutA = await runGuest(boundedSource, { fuel: limits.wasmFuel, timeoutMs: limits.perTurnMs, hostTimeoutMs: 3000 });
  const quotaTimeoutB = await runGuest(boundedSource, { fuel: limits.wasmFuel, timeoutMs: limits.perTurnMs, hostTimeoutMs: 3000 });
  const quotaResetAfterTimeout = await runGuest(abiSource, { fuel: limits.wasmStartupFuel ?? limits.wasmFuel, timeoutMs: limits.perTurnMs, hostTimeoutMs: 3000 });
  const perTurnQuotaPass = [quotaTimeoutA, quotaTimeoutB].every((run) => run.code !== 0 && run.elapsedMs <= 3000 && /fuel|timed out|timeout|interrupt/i.test(`${run.stdout}\n${run.stderr}`))
    && quotaResetAfterTimeout.code === 0;

  const sleeping = await runGuest("import time\ntime.sleep(2)", { timeoutMs: limits.perTurnMs, hostTimeoutMs: 3000 });
  const sleepPass = sleeping.code !== 0 && sleeping.elapsedMs <= 3000 && /fuel|timed out|timeout|interrupt|unsupported|not implemented|not supported/i.test(`${sleeping.stdout}\n${sleeping.stderr}`);

  const memory = await runGuest("bytearray(128 * 1024 * 1024)", { fuel: 10_000_000_000, timeoutMs: 2000, hostTimeoutMs: 4000 });
  const memoryPass = memory.code !== 0 && /forcing trap when growing memory/i.test(`${memory.stdout}\n${memory.stderr}`);

  const flood = await runGuest("print('x' * 20000)", { fuel: 1_000_000_000, timeoutMs: 1000, hostTimeoutMs: 3000 });
  const outputBudgetPass = flood.outputExceeded && flood.code !== 0 && flood.outputBytes > limits.outputBytes;

  const cancelled = await runGuest(boundedSource, { fuel: limits.wasmFuel, timeoutMs: 5000, hostTimeoutMs: 1500, cancelAfterMs: 50 });
  const cancellationPass = cancelled.cancelled && cancelled.code !== 0;
  const reclaim = await runGuest(abiSource);
  const reclaimPass = reclaim.code === 0;

  const deterministicA = await runGuest(deterministicSource, { fuel: 1_000_000_000, timeoutMs: 1000 });
  const deterministicB = await runGuest(deterministicSource, { fuel: 1_000_000_000, timeoutMs: 1000 });
  const deterministicC = await runGuest(alternateDeterministicSource, { fuel: 1_000_000_000, timeoutMs: 1000 });
  const determinismPass = deterministicA.code === 0 && deterministicB.code === 0 && deterministicC.code === 0 && deterministicA.stdout === deterministicB.stdout && deterministicA.stdout !== deterministicC.stdout;
  const deterministicOutputHashes = {
    sameSeedA: createHash("sha256").update(deterministicA.stdout).digest("hex"),
    sameSeedB: createHash("sha256").update(deterministicB.stdout).digest("hex"),
    differentSeed: createHash("sha256").update(deterministicC.stdout).digest("hex")
  };

  const headroomRuns = [];
  for (let index = 0; index < 12; index += 1) headroomRuns.push(await runGuest(abiSource));
  const headroomTimes = headroomRuns.map((run) => run.elapsedMs).sort((left, right) => left - right);
  const p95Index = Math.min(headroomTimes.length - 1, Math.ceil(headroomTimes.length * 0.95) - 1);
  const headroomPass = headroomRuns.every((run) => run.code === 0 && run.elapsedMs <= limits.perTurnMs) && headroomTimes[p95Index] <= limits.perTurnMs;

  const wholeMatchStartedAt = performance.now();
  const blueMatchRun = await runGuest(wholeMatchBlueSource, { timeoutMs: limits.wholeMatchMs, hostTimeoutMs: limits.wholeMatchMs + 2000 });
  const redMatchRun = await runGuest(wholeMatchRedSource, { timeoutMs: limits.wholeMatchMs, hostTimeoutMs: limits.wholeMatchMs + 2000 });
  const wholeMatchElapsedMs = Math.round(performance.now() - wholeMatchStartedAt);
  const parseWholeMatch = (run) => {
    try { return JSON.parse(run.stdout.trim()); } catch { return null; }
  };
  const blueMatchValue = parseWholeMatch(blueMatchRun);
  const redMatchValue = parseWholeMatch(redMatchRun);
  const blueMatchRuns = blueMatchValue?.turns ?? [];
  const redMatchRuns = redMatchValue?.turns ?? [];
  const sideTurnTimes = (turns) => turns.map((turn) => (turn.elapsedUs ?? 0) / 1000).sort((left, right) => left - right);
  const blueMatchTimes = sideTurnTimes(blueMatchRuns);
  const redMatchTimes = sideTurnTimes(redMatchRuns);
  const sideP95 = (times) => times.length === 0 ? null : times[Math.min(times.length - 1, Math.ceil(times.length * 0.95) - 1)];
  const blueTurnP95 = sideP95(blueMatchTimes);
  const redTurnP95 = sideP95(redMatchTimes);
  const wholeMatchRuns = [...blueMatchRuns, ...redMatchRuns];
  const wholeMatchPass = blueMatchValue?.side === "BLUE"
    && redMatchValue?.side === "RED"
    && blueMatchRuns.length === limits.maxRounds
    && redMatchRuns.length === limits.maxRounds
    && blueMatchValue.statePly === limits.maxRounds
    && redMatchValue.statePly === limits.maxRounds
    && blueMatchValue.memorySeen === limits.maxRounds
    && redMatchValue.memorySeen === limits.maxRounds
    && wholeMatchElapsedMs <= limits.wholeMatchMs
    && blueMatchRun.code === 0
    && redMatchRun.code === 0
    && blueMatchRun.elapsedMs <= limits.wholeMatchMs
    && redMatchRun.elapsedMs <= limits.wholeMatchMs
    && blueTurnP95 <= limits.perTurnMs
    && redTurnP95 <= limits.perTurnMs;

  let activeAdmissions = 0;
  const acquireAdmission = () => {
    if (activeAdmissions >= 1) return false;
    activeAdmissions += 1;
    return true;
  };
  const releaseAdmission = () => { activeAdmissions = Math.max(0, activeAdmissions - 1); };
  const firstAdmissionGranted = acquireAdmission();
  const secondAdmissionRejected = !acquireAdmission();
  const admittedRun = firstAdmissionGranted ? await runGuest(abiSource) : null;
  releaseAdmission();
  const admissionPass = firstAdmissionGranted && secondAdmissionRejected && admittedRun?.code === 0 && activeAdmissions === 0;

  let apiServer;
  let apiOrigin;
  const apiRuns = [];
  let apiConcurrentStatuses = [];
  try {
    apiServer = createServer(async (request, response) => {
      if (request.method !== "POST" || request.url !== "/invoke") {
        response.writeHead(404);
        response.end();
        return;
      }
      if (!acquireAdmission()) {
        response.writeHead(429, { "content-type": "application/json" });
        response.end(JSON.stringify({ ok: false, reason: "ADMISSION_FULL" }));
        return;
      }
      const startedAt = performance.now();
      try {
        const run = await runGuest(abiSource);
        response.writeHead(run.code === 0 ? 200 : 500, { "content-type": "application/json" });
        response.end(JSON.stringify({ ok: run.code === 0, elapsedMs: Math.round(performance.now() - startedAt) }));
      } finally {
        releaseAdmission();
      }
    });
    await new Promise((resolvePromise) => apiServer.listen(0, "127.0.0.1", resolvePromise));
    const address = apiServer.address();
    apiOrigin = `http://127.0.0.1:${address.port}`;
    for (let index = 0; index < 12; index += 1) {
      const startedAt = performance.now();
      const response = await fetch(`${apiOrigin}/invoke`, { method: "POST", body: "{}" });
      const body = await response.json();
      apiRuns.push({ status: response.status, elapsedMs: Math.round(performance.now() - startedAt), ok: body.ok === true });
    }
    const concurrentResponses = await Promise.all([
      fetch(`${apiOrigin}/invoke`, { method: "POST", body: "{}" }),
      fetch(`${apiOrigin}/invoke`, { method: "POST", body: "{}" }),
    ]);
    apiConcurrentStatuses = concurrentResponses.map((response) => response.status).sort((left, right) => left - right);
    await Promise.all(concurrentResponses.map((response) => response.arrayBuffer()));
  } catch {
    apiRuns.length = 0;
    apiConcurrentStatuses = [];
  } finally {
    if (apiServer) await new Promise((resolvePromise) => apiServer.close(resolvePromise));
  }
  const apiTimes = apiRuns.map((run) => run.elapsedMs).sort((left, right) => left - right);
  const apiP95Index = Math.min(apiTimes.length - 1, Math.ceil(apiTimes.length * 0.95) - 1);
  const apiHeadroomPass = apiRuns.length === 12
    && apiRuns.every((run) => run.status === 200 && run.ok && run.elapsedMs <= limits.perTurnMs)
    && apiTimes[apiP95Index] <= limits.perTurnMs;
  const apiAdmissionPass = apiConcurrentStatuses.length === 2 && apiConcurrentStatuses[0] === 200 && apiConcurrentStatuses[1] === 429;

  const checks = {
    abi: { pass: abiPass, code: abi.code, elapsedMs: abi.elapsedMs, outputBytes: abi.outputBytes, startup: describeRuntimeStartup(abi) },
    environmentIsolation: { pass: environmentPass, value: envValue?.env ?? null },
    filesystemBoundary: { pass: filesystemPass && readonlyMutationPass, observed: { outsideSentinelExists, outsideSentinelOutsideRuntime, guestSentinelPath, guestRead: envValue?.file ?? null, guestWrite: envValue?.write ?? null, readonlyProbeExists, readonlyProbeGuestPath, unlink: readonlyMutationValue?.unlink ?? null, rename: readonlyMutationValue?.rename ?? null } },
    networkIsolation: { pass: networkPass, code: network.code, observed: `${network.stdout}\n${network.stderr}`.trim().slice(0, 240) },
    pathTraversal: { pass: pathTraversalPass, observed: pathValue },
    infiniteLoopBudget: { pass: boundedPass, code: bounded.code, observed: `${bounded.stdout}\n${bounded.stderr}`.trim().slice(0, 240) },
    perTurnQuota: { pass: perTurnQuotaPass, consecutiveTimeouts: [quotaTimeoutA, quotaTimeoutB].map((run) => ({ code: run.code, elapsedMs: run.elapsedMs, hostTimedOut: run.hostTimedOut })), resetTurn: { code: quotaResetAfterTimeout.code, elapsedMs: quotaResetAfterTimeout.elapsedMs }, enforcement: "fresh Wasmtime invocation per turn; timeout/fuel failure reclaimed before next turn" },
    sleepBudget: { pass: sleepPass, code: sleeping.code, elapsedMs: sleeping.elapsedMs, observed: `${sleeping.stdout}\n${sleeping.stderr}`.trim().slice(0, 240) },
    memoryBoundary: { pass: memoryPass, code: memory.code, observed: `${memory.stdout}\n${memory.stderr}`.trim().slice(0, 240) },
    outputBudget: { pass: outputBudgetPass, outputBytes: flood.outputBytes, manifestOutputBytes: limits.outputBytes, terminated: flood.outputExceeded },
    cancellation: { pass: cancellationPass, cancelled: cancelled.cancelled, code: cancelled.code, elapsedMs: cancelled.elapsedMs },
    killReclaim: { pass: reclaimPass, code: reclaim.code, elapsedMs: reclaim.elapsedMs },
    determinism: { pass: determinismPass, sameSeedSameState: deterministicA.stdout === deterministicB.stdout, differentSeedChangesResult: deterministicA.stdout !== deterministicC.stdout, ...deterministicOutputHashes },
    headroom: { pass: headroomPass, count: headroomRuns.length, minMs: headroomTimes[0], p95Ms: headroomTimes[p95Index], maxMs: headroomTimes.at(-1), failures: headroomRuns.filter((run) => run.code !== 0).length },
    wholeMatchBudget: {
      pass: wholeMatchPass,
      blueRounds: blueMatchRuns.length,
      redRounds: redMatchRuns.length,
      expectedRoundsPerSide: limits.maxRounds,
      elapsedMs: wholeMatchElapsedMs,
      limitMs: limits.wholeMatchMs,
      blueRuntimeMs: blueMatchRun.elapsedMs,
      redRuntimeMs: redMatchRun.elapsedMs,
      blueFixtureTurnP95Ms: blueTurnP95,
      redFixtureTurnP95Ms: redTurnP95,
      blueFixtureTurnMaxMs: blueMatchTimes.at(-1) ?? null,
      redFixtureTurnMaxMs: redMatchTimes.at(-1) ?? null,
    },
    admission: { pass: admissionPass, capacity: 1, firstGranted: firstAdmissionGranted, secondRejected: secondAdmissionRejected, activeAfterRelease: activeAdmissions },
    apiHeadroom: { pass: apiHeadroomPass, requests: apiRuns.length, p95Ms: apiTimes[apiP95Index] ?? null, maxMs: apiTimes.at(-1) ?? null, concurrentStatuses: apiConcurrentStatuses, admissionPass: apiAdmissionPass, origin: apiOrigin ? "loopback-ephemeral" : null },
  };
  const allPass = Object.values(checks).every((check) => check.pass === true);
  const report = {
    measuredAt: new Date().toISOString(),
    runtimeGate: allPass ? "PROVEN_FOR_WASMTIME_CPYTHON_WASI_PROBE" : "NOT_PROVEN",
    fixtureCodeExecuted: true,
    playerCodeExecuted: false,
    runtime: {
      wasmtimePath: wasmtimePath,
      wasmtimeSha256: await sha256(wasmtimePath),
      cpythonWasiDir: cpythonDir,
      cpythonWasmSha256: await sha256(runtimeWasm),
      cpythonWasmBytes: runtimeStat.size,
      limits: {
        wasmStartupFuel: limits.wasmStartupFuel ?? limits.wasmFuel,
        wasmFuel: limits.wasmFuel,
        perTurnMs: limits.perTurnMs,
        outputBytes: limits.outputBytes,
        wasmMemoryPages: limits.wasmMemoryPages,
      },
    },
    checks,
  };
  console.log(JSON.stringify(report, null, 2));
  if (requirePass && !allPass) process.exitCode = 1;
}
