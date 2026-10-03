import os from "node:os";
import process from "node:process";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

function commandExists(command) {
  try {
    execFileSync(process.platform === "win32" ? "where.exe" : "which", [command], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/** Probe host capacity and runtime availability only; never executes player Python. */
console.log(JSON.stringify({
  measuredAt: new Date().toISOString(),
  node: process.version,
  platform: process.platform,
  arch: process.arch,
  cpuCount: os.cpus().length,
  totalMemoryBytes: os.totalmem(),
  freeMemoryBytes: os.freemem(),
  wasmtime: commandExists("wasmtime"),
  cpythonWasi: commandExists("cpython-wasi") || commandExists("python-wasi"),
  pyodideBundleCheckedIn: existsSync(resolve("apps/web/public/pyodide/pyodide.mjs")),
  playerCodeExecuted: false,
}, null, 2));
