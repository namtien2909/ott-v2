import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { chmod, mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { cpus, freemem, tmpdir, totalmem } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { spawn } from "node:child_process";
import { inflateRawSync } from "node:zlib";
import { describeRuntimeStartup } from "./r3-runtime-startup.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = resolve(dirname(scriptPath), "..");
const reportPath = resolve(repoRoot, "apps/server/dist/r3-provider-evidence.json");
const artifactManifest = JSON.parse(await readFile(resolve(repoRoot, "docs/r3-runtime-artifacts.json"), "utf8"));
// Use the checked-in manifest as the single source of release pins. Validate
// their format before downloading so a truncated digest fails immediately.
const pinned = {
  wasmtimeLinuxArchive: artifactManifest.artifacts.wasmtime.linuxArchive,
  wasmtimeLinuxArchiveUrl: artifactManifest.artifacts.wasmtime.linuxArchiveUrl,
  wasmtimeLinuxArchiveSha256: artifactManifest.artifacts.wasmtime.linuxArchiveSha256,
  wasmtimeLinuxBinarySha256: artifactManifest.artifacts.wasmtime.linuxBinarySha256,
  cpythonArchive: artifactManifest.artifacts.cpythonWasi.archive,
  cpythonArchiveSha256: artifactManifest.artifacts.cpythonWasi.archiveSha256,
  cpythonWasmSha256: artifactManifest.artifacts.cpythonWasi.wasmSha256
};
for (const [key, value] of Object.entries(pinned)) {
  if (key.endsWith("Sha256") && !/^[a-f0-9]{64}$/.test(value)) {
    throw new Error(`Invalid SHA-256 pin: ${key}; expected 64 hexadecimal characters.`);
  }
}
const verifyArtifactsOnly = process.argv.includes("--verify-artifacts-only");
const requirePass = process.argv.includes("--require-pass") || verifyArtifactsOnly;
const shouldRun = verifyArtifactsOnly || process.env.RENDER === "true" || process.env.RENDER === "1" || process.env.R3_PROVIDER_PROBE === "1";
let probeStage = "not_started";
let failureStartup;
let failureChecks = [];
let failureObservedChecks = {};

export function sanitizeProbeChecks(checks = {}) {
  const allowed = new Set([
    "pass", "elapsedMs", "minMs", "p95Ms", "maxMs", "limitMs", "outputBytes", "limit", "terminated",
    "blueRounds", "redRounds", "blueRuntimeMs", "redRuntimeMs", "blueFixtureTurnP95Ms",
    "redFixtureTurnP95Ms", "blueFixtureTurnMaxMs", "redFixtureTurnMaxMs", "entrypointCallsPerSide",
    "memoryUpdatesPerSide", "capacity", "firstGranted", "secondRejected", "activeAfterRelease", "requests",
    "concurrentStatuses", "concurrentElapsedMs", "databaseMutated", "sameSeedSameState", "differentSeedChangesResult",
    "consecutiveTimeouts", "resetTurn"
  ]);
  return Object.fromEntries(Object.entries(checks).map(([name, value]) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [name, {}];
    return [name, Object.fromEntries(Object.entries(value).filter(([key]) => allowed.has(key)))];
  }));
}

function runCommand(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { ...options, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    const stdout = [];
    const stderr = [];
    let bytes = 0;
    const collect = (target, chunk) => {
      if (bytes >= 2_000_000) return;
      const buffer = Buffer.from(chunk);
      const captured = buffer.subarray(0, 2_000_000 - bytes);
      bytes += captured.byteLength;
      target.push(captured);
    };
    child.stdout.on("data", (chunk) => collect(stdout, chunk));
    child.stderr.on("data", (chunk) => collect(stderr, chunk));
    child.once("error", reject);
    child.once("close", (code, signal) => resolvePromise({
      code,
      signal,
      stdout: Buffer.concat(stdout).toString("utf8"),
      stderr: Buffer.concat(stderr).toString("utf8")
    }));
  });
}

async function sha256(filePath) {
  const hash = createHash("sha256");
  hash.update(await readFile(filePath));
  return hash.digest("hex");
}

async function download(url, destination) {
  // GitHub release assets intentionally redirect to a content-addressed
  // release host. The URL is pinned in the checked-in manifest and the
  // downloaded bytes are hash-verified before anything is executed.
  const partial = `${destination}.partial`;
  await rm(partial, { force: true });
  if (process.platform !== "win32") {
    try {
      const curl = await runCommand("curl", ["--fail", "--location", "--retry", "3", "--retry-all-errors", "--silent", "--show-error", "--output", partial, url]);
      if (curl.code === 0) {
        await rename(partial, destination);
        return;
      }
    } catch {
      // Fall back to Node fetch when curl is unavailable in a build image.
    }
    await rm(partial, { force: true });
  }
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok || !response.body) throw new Error(`Pinned runtime download failed (${response.status}).`);
  await pipeline(Readable.fromWeb(response.body), createWriteStream(partial, { flags: "wx" }));
  await rename(partial, destination);
}

async function extractArchive(archivePath, destination, stripComponents = false) {
  await mkdir(destination, { recursive: true });
  if (archivePath.toLowerCase().endsWith(".zip")) {
    await extractZipArchive(archivePath, destination);
    return;
  }
  const args = ["-xf", archivePath, "-C", destination];
  if (stripComponents) args.push("--strip-components=1");
  const extraction = await runCommand("tar", args);
  if (extraction.code !== 0) throw new Error("Pinned runtime extraction failed.");
}

export async function extractZipArchive(archivePath, destination) {
  const archive = await readFile(archivePath);
  const endSignature = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
  const endOffset = archive.lastIndexOf(endSignature);
  if (endOffset < 0 || endOffset + 22 > archive.length) throw new Error("Pinned ZIP archive has no valid central directory.");
  const entryCount = archive.readUInt16LE(endOffset + 10);
  const centralSize = archive.readUInt32LE(endOffset + 12);
  const centralOffset = archive.readUInt32LE(endOffset + 16);
  if (centralOffset + centralSize > archive.length) throw new Error("Pinned ZIP central directory is out of bounds.");
  let cursor = centralOffset;
  let totalOutputBytes = 0;
  for (let index = 0; index < entryCount; index += 1) {
    if (cursor + 46 > archive.length || archive.readUInt32LE(cursor) !== 0x02014b50) throw new Error("Pinned ZIP central directory entry is invalid.");
    const flags = archive.readUInt16LE(cursor + 8);
    const compression = archive.readUInt16LE(cursor + 10);
    const compressedSize = archive.readUInt32LE(cursor + 20);
    const uncompressedSize = archive.readUInt32LE(cursor + 24);
    const nameLength = archive.readUInt16LE(cursor + 28);
    const extraLength = archive.readUInt16LE(cursor + 30);
    const commentLength = archive.readUInt16LE(cursor + 32);
    const localOffset = archive.readUInt32LE(cursor + 42);
    const nameStart = cursor + 46;
    const name = archive.subarray(nameStart, nameStart + nameLength).toString("utf8");
    cursor = nameStart + nameLength + extraLength + commentLength;
    if ((flags & 0x01) !== 0 || (compression !== 0 && compression !== 8)) throw new Error("Pinned ZIP uses an unsupported or encrypted entry.");
    const safeName = name.replaceAll("\\", "/");
    if (safeName.startsWith("/") || safeName.split("/").some((part) => part === "..")) throw new Error("Pinned ZIP contains an unsafe path.");
    if (safeName.endsWith("/")) {
      await mkdir(join(destination, safeName), { recursive: true });
      continue;
    }
    if (localOffset + 30 > archive.length || archive.readUInt32LE(localOffset) !== 0x04034b50) throw new Error("Pinned ZIP local entry is invalid.");
    const localNameLength = archive.readUInt16LE(localOffset + 26);
    const localExtraLength = archive.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > archive.length) throw new Error("Pinned ZIP entry is out of bounds.");
    const compressed = archive.subarray(dataStart, dataEnd);
    const output = compression === 0 ? compressed : inflateRawSync(compressed);
    if (output.length !== uncompressedSize) throw new Error("Pinned ZIP entry size mismatch.");
    totalOutputBytes += output.length;
    if (totalOutputBytes > 1_000_000_000) throw new Error("Pinned ZIP expands beyond the probe safety limit.");
    const target = join(destination, safeName);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, output, { flag: "wx" });
  }
}

async function findFile(root, name) {
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const candidate = join(root, entry.name);
    if (entry.isFile() && entry.name === name) return candidate;
    if (entry.isDirectory()) {
      const nested = await findFile(candidate, name);
      if (nested) return nested;
    }
  }
  return null;
}

async function makeReadOnly(root) {
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const candidate = join(root, entry.name);
    const details = await stat(candidate);
    await chmod(candidate, details.mode & ~0o222);
    if (entry.isDirectory()) await makeReadOnly(candidate);
  }
  const details = await stat(root);
  await chmod(root, details.mode & ~0o222);
}

function parseProbe(stdout) {
  try {
    return JSON.parse(stdout.trim());
  } catch {
    throw new Error("Pinned runtime probe did not return JSON.");
  }
}

function runFixedGuest(wasmtimePath, cpythonDir, source, timeoutMs = 500) {
  const args = [
    "run", "--dir", ".::/", "-W", "fuel=300000000", "-W", `timeout=${timeoutMs}ms`,
    "-W", "max-memory-size=67108864", "-W", "trap-on-grow-failure=y", "--env", "PYTHONHASHSEED=0", "--env", "TZ=UTC",
    "python.wasm", "-c", source
  ];
  return new Promise((resolvePromise, reject) => {
    const startedAt = performance.now();
    const child = spawn(wasmtimePath, args, {
      cwd: cpythonDir,
      env: { PATH: process.env.PATH ?? "", PYTHONHASHSEED: "0", TZ: "UTC", RAYON_NUM_THREADS: "1" },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });
    const stdout = [];
    const stderr = [];
    let timer;
    const finish = (result) => {
      clearTimeout(timer);
      resolvePromise({ ...result, elapsedMs: Math.round(performance.now() - startedAt) });
    };
    child.stdout.on("data", (chunk) => stdout.push(Buffer.from(chunk).subarray(0, 65536)));
    child.stderr.on("data", (chunk) => stderr.push(Buffer.from(chunk).subarray(0, 65536)));
    child.once("error", reject);
    child.once("close", (code, signal) => finish({
      code,
      signal,
      stdout: Buffer.concat(stdout).toString("utf8"),
      stderr: Buffer.concat(stderr).toString("utf8")
    }));
    timer = setTimeout(() => child.kill(), Math.max(timeoutMs + 1500, 2500));
  });
}

async function runAdmissionScheduler(wasmtimePath, cpythonDir) {
  const fixedSource = "import json\nprint(json.dumps({'fixture':'r3-provider','ok':True}, separators=(',', ':')))";
  const pending = [];
  const results = [];
  let active = 0;
  let maxActive = 0;
  let nextId = 0;
  let resolver;
  let settled = false;
  const drained = new Promise((resolvePromise) => { resolver = resolvePromise; });
  const pump = () => {
    while (active < 1 && pending.length > 0) {
      const job = pending.shift();
      if (!job) break;
      active += 1;
      maxActive = Math.max(maxActive, active);
      runFixedGuest(wasmtimePath, cpythonDir, fixedSource).then((result) => {
        active -= 1;
        results.push({ id: job.id, code: result.code, elapsedMs: result.elapsedMs, validOutput: result.stdout.includes('"ok":true') });
        job.resolve();
        pump();
      }).catch((error) => {
        active -= 1;
        job.reject(error);
        pump();
      });
    }
    if (!settled && pending.length === 0 && active === 0) {
      settled = true;
      resolver();
    }
  };
  const submissions = Array.from({ length: 4 }, () => new Promise((resolvePromise, reject) => {
    pending.push({ id: nextId++, resolve: resolvePromise, reject });
  }));
  pump();
  await Promise.all(submissions);
  await drained;
  results.sort((left, right) => left.id - right.id);
  return {
    pass: results.length === 4 && maxActive === 1 && results.every((result) => result.code === 0 && result.validOutput),
    requested: 4,
    completed: results.length,
    maxConcurrent: maxActive,
    results
  };
}

function buildReport(probe, scheduler) {
  return {
    schemaVersion: 1,
    status: probe.runtimeGate === "PROVEN_FOR_WASMTIME_CPYTHON_WASI_PROBE" && scheduler.pass ? "PROVEN" : "NOT_PROVEN",
    runtimeGate: "PROVEN_FOR_RENDER_FREE_PINNED_WASMTIME_CPYTHON_WASI_FIXTURES",
    measuredAt: probe.measuredAt,
    playerCodeExecuted: false,
    fixtureCodeExecuted: true,
    provider: {
      platform: process.platform,
      arch: process.arch,
      cpuCount: cpus().length,
      totalMemoryBytes: totalmem(),
      freeMemoryBytes: freemem()
    },
    artifacts: {
      wasmtimeVersion: "49.0.2",
      wasmtimeBinarySha256: pinned.wasmtimeLinuxBinarySha256,
      cpythonVersion: "3.14.7",
      cpythonWasmSha256: pinned.cpythonWasmSha256
    },
    checks: sanitizeProbeChecks(probe.checks),
    scheduler,
    security: { network: false, filesystem: false, secrets: false, applicationMounts: false },
    scope: "Fixed compatibility fixtures only; no player source, upload, application commit or private payload was executed."
  };
}

async function main() {
  if (!shouldRun) return;
  probeStage = "prepare-workdir";
  const root = resolve(process.env.R3_PROVIDER_WORKDIR ?? join(tmpdir(), `ottv2-r3-provider-${process.pid}`));
  const wasmtimeArchive = join(root, pinned.wasmtimeLinuxArchive);
  const cpythonArchive = join(root, pinned.cpythonArchive);
  const wasmtimeRoot = join(root, "wasmtime");
  const cpythonRoot = join(root, "cpython");
  await mkdir(root, { recursive: true });
  probeStage = "download-wasmtime";
  await download(pinned.wasmtimeLinuxArchiveUrl, wasmtimeArchive);
  probeStage = "download-cpython";
  await download(`https://github.com/brettcannon/cpython-wasi-build/releases/download/v3.14.7/${pinned.cpythonArchive}`, cpythonArchive);
  probeStage = "verify-wasmtime-archive";
  const wasmtimeArchiveSha256 = await sha256(wasmtimeArchive);
  if (wasmtimeArchiveSha256.toLowerCase() !== pinned.wasmtimeLinuxArchiveSha256) throw new Error(`Wasmtime archive hash mismatch (${wasmtimeArchiveSha256}).`);
  probeStage = "verify-cpython-archive";
  const cpythonArchiveSha256 = await sha256(cpythonArchive);
  if (cpythonArchiveSha256.toLowerCase() !== pinned.cpythonArchiveSha256) throw new Error(`CPython-WASI archive hash mismatch (${cpythonArchiveSha256}).`);
  probeStage = "extract-wasmtime";
  await extractArchive(wasmtimeArchive, wasmtimeRoot, true);
  probeStage = "extract-cpython";
  await extractArchive(cpythonArchive, cpythonRoot);
  probeStage = "locate-runtime";
  const wasmtimePath = await findFile(wasmtimeRoot, "wasmtime");
  const cpythonWasm = await findFile(cpythonRoot, "python.wasm");
  if (!wasmtimePath || !cpythonWasm) throw new Error("Pinned runtime files were not found after extraction.");
  probeStage = "verify-runtime-binaries";
  if ((await sha256(wasmtimePath)).toLowerCase() !== pinned.wasmtimeLinuxBinarySha256) throw new Error("Wasmtime binary hash mismatch.");
  if ((await sha256(cpythonWasm)).toLowerCase() !== pinned.cpythonWasmSha256) throw new Error("CPython-WASI binary hash mismatch.");
  if (verifyArtifactsOnly) {
    console.log(JSON.stringify({ status: "PASS", scope: "artifact-verification-only", wasmtimeArchiveSha256, cpythonArchiveSha256, wasmtimeBinarySha256: pinned.wasmtimeLinuxBinarySha256, cpythonWasmSha256: pinned.cpythonWasmSha256, fixtureCodeExecuted: false, playerCodeExecuted: false }));
    return;
  }
  const runtimeDir = dirname(cpythonWasm);
  probeStage = "check-wasmtime-launch";
  const launch = await runCommand(wasmtimePath, ["--version"], { env: { PATH: process.env.PATH ?? "", RAYON_NUM_THREADS: "1" } });
  if (launch.code !== 0) {
    failureStartup = describeRuntimeStartup(launch);
    throw new Error(`Wasmtime launch failed: ${failureStartup.cause}.`);
  }
  const outsideSentinel = join(root, "outside-sentinel.txt");
  const readonlyProbe = join(runtimeDir, "r3-readonly-probe.txt");
  probeStage = "prepare-readonly-runtime";
  await writeFile(outsideSentinel, "outside-sentinel", { flag: "wx" });
  await writeFile(readonlyProbe, "readonly-probe", { flag: "wx" });
  await makeReadOnly(cpythonRoot);
  probeStage = "run-wasmtime-security-probe";
  const probeResult = await runCommand(process.execPath, [
    resolve(repoRoot, "scripts/r3-wasmtime-probe.mjs"),
    "--wasmtime", wasmtimePath,
    "--cpython-dir", cpythonRoot,
    "--outside-sentinel", outsideSentinel,
    "--readonly-probe-file", readonlyProbe,
    "--wasmtime-sha256", pinned.wasmtimeLinuxBinarySha256,
    "--require-pass"
  ], { cwd: repoRoot });
  probeStage = "parse-wasmtime-security-probe";
  const probe = parseProbe(probeResult.stdout);
  if (probeResult.code !== 0) {
    const failedChecks = Object.entries(probe.checks ?? {}).filter(([, check]) => check.pass !== true).map(([name]) => name.replace(/[^a-zA-Z0-9_-]/g, ""));
    failureStartup = probe.checks?.abi?.startup;
    failureChecks = failedChecks;
    failureObservedChecks = sanitizeProbeChecks(probe.checks);
    console.error(`R3 runtime ABI startup: ${JSON.stringify(probe.checks?.abi?.startup ?? { cause: "UNAVAILABLE" })}`);
    // Print names individually so neither build logs nor message sanitization
    // truncate the root-cause evidence behind a long list.
    for (const name of failedChecks) console.error(`R3 failed check: ${name}`);
    throw new Error("Pinned provider runtime probe failed; see ABI startup and check names above.");
  }
  probeStage = "run-admission-scheduler";
  const scheduler = await runAdmissionScheduler(wasmtimePath, cpythonRoot);
  probeStage = "write-provider-evidence";
  const report = buildReport(probe, scheduler);
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  if (report.status !== "PROVEN") throw new Error("Provider runtime evidence did not pass.");
}

try {
  await main();
} catch (error) {
  if (shouldRun) {
    await mkdir(dirname(reportPath), { recursive: true });
    await writeFile(reportPath, `${JSON.stringify({
      schemaVersion: 1,
      status: "NOT_PROVEN",
      runtimeGate: "NOT_PROVEN",
      measuredAt: new Date().toISOString(),
      playerCodeExecuted: false,
      fixtureCodeExecuted: false,
      stage: probeStage,
      startup: failureStartup,
      failedChecks: failureChecks,
      checks: failureObservedChecks,
      reason: "Provider probe failed closed; no player code was executed."
    }, null, 2)}\n`, "utf8");
    const safeReason = error instanceof Error ? error.message.replace(/[^a-zA-Z0-9:_(). -]/g, "").slice(0, 220) : "UnknownError";
    console.error(`R3 provider probe failed closed at ${probeStage}: ${safeReason}`);
    // Existing API/SPA deployment does not enable player Python. Record a
    // failed feasibility gate without taking that application down. Strict
    // acceptance runs still fail the command through --require-pass.
    process.exitCode = requirePass ? 1 : 0;
  }
}
