import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { chmod, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { cpus, freemem, tmpdir, totalmem } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { spawn } from "node:child_process";
import { inflateRawSync } from "node:zlib";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = resolve(dirname(scriptPath), "..");
const reportPath = resolve(repoRoot, "apps/server/dist/r3-provider-evidence.json");
const artifactManifest = JSON.parse(await readFile(resolve(repoRoot, "docs/r3-runtime-artifacts.json"), "utf8"));
const wasmtime = artifactManifest.artifacts.wasmtime;
const cpython = artifactManifest.artifacts.cpythonWasi;
const shouldRun = process.env.RENDER === "true" || process.env.RENDER === "1" || process.env.R3_PROVIDER_PROBE === "1";
let probeStage = "not_started";

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
      bytes += buffer.byteLength;
      target.push(buffer.subarray(0, Math.max(0, 2_000_000 - bytes)));
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
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok || !response.body) throw new Error(`Pinned runtime download failed (${response.status}).`);
  await pipeline(Readable.fromWeb(response.body), createWriteStream(destination, { flags: "wx" }));
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
      env: { PATH: process.env.PATH ?? "", PYTHONHASHSEED: "0", TZ: "UTC" },
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
      wasmtimeVersion: wasmtime.version,
      wasmtimeBinarySha256: wasmtime.linuxBinarySha256,
      cpythonVersion: cpython.version,
      cpythonWasmSha256: cpython.wasmSha256
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
  const wasmtimeArchive = join(root, wasmtime.linuxArchive);
  const cpythonArchive = join(root, cpython.archive);
  const wasmtimeRoot = join(root, "wasmtime");
  const cpythonRoot = join(root, "cpython");
  await mkdir(root, { recursive: true });
  probeStage = "download-wasmtime";
  await download(wasmtime.linuxArchiveUrl, wasmtimeArchive);
  probeStage = "download-cpython";
  await download(`https://github.com/brettcannon/cpython-wasi-build/releases/download/v${cpython.version}/${cpython.archive}`, cpythonArchive);
  probeStage = "verify-wasmtime-archive";
  if ((await sha256(wasmtimeArchive)).toLowerCase() !== wasmtime.linuxArchiveSha256.toLowerCase()) throw new Error("Wasmtime archive hash mismatch.");
  probeStage = "verify-cpython-archive";
  if ((await sha256(cpythonArchive)).toLowerCase() !== cpython.archiveSha256.toLowerCase()) throw new Error("CPython-WASI archive hash mismatch.");
  probeStage = "extract-wasmtime";
  await extractArchive(wasmtimeArchive, wasmtimeRoot, true);
  probeStage = "extract-cpython";
  await extractArchive(cpythonArchive, cpythonRoot);
  probeStage = "locate-runtime";
  const wasmtimePath = await findFile(wasmtimeRoot, wasmtime.linuxBinary);
  const cpythonWasm = await findFile(cpythonRoot, cpython.wasm);
  if (!wasmtimePath || !cpythonWasm) throw new Error("Pinned runtime files were not found after extraction.");
  probeStage = "verify-runtime-binaries";
  if ((await sha256(wasmtimePath)).toLowerCase() !== wasmtime.linuxBinarySha256.toLowerCase()) throw new Error("Wasmtime binary hash mismatch.");
  if ((await sha256(cpythonWasm)).toLowerCase() !== cpython.wasmSha256.toLowerCase()) throw new Error("CPython-WASI binary hash mismatch.");
  const runtimeDir = dirname(cpythonWasm);
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
    "--wasmtime-sha256", wasmtime.linuxBinarySha256,
    "--require-pass"
  ], { cwd: repoRoot });
  if (probeResult.code !== 0) throw new Error("Pinned provider runtime probe failed.");
  probeStage = "parse-wasmtime-security-probe";
  const probe = parseProbe(probeResult.stdout);
  probeStage = "run-admission-scheduler";
  const scheduler = await runAdmissionScheduler(wasmtimePath, cpythonRoot);
  probeStage = "write-provider-evidence";
  const report = buildReport(probe, scheduler);
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  if (report.status !== "PROVEN") throw new Error("Provider runtime evidence did not pass.");
}

try {
  await main();
} catch {
  if (shouldRun) {
    await mkdir(dirname(reportPath), { recursive: true });
    await writeFile(reportPath, `${JSON.stringify({
      schemaVersion: 1,
      status: "NOT_PROVEN",
      runtimeGate: "NOT_PROVEN",
      measuredAt: new Date().toISOString(),
      playerCodeExecuted: false,
      fixtureCodeExecuted: false,
      reason: "Provider probe failed closed; no player code was executed."
    }, null, 2)}\n`, "utf8");
    console.error(`R3 provider probe failed closed at ${probeStage}.`);
    process.exitCode = 1;
  }
}
