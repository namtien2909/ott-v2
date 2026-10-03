import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { access, readFile, stat } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = resolve(fileURLToPath(new URL(".", import.meta.url)));
const repoRoot = resolve(scriptDir, "..");
const cliArgs = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const key = process.argv[index];
  if (key.startsWith("--")) cliArgs.set(key, process.argv[index + 1]);
}
const pyodideDir = cliArgs.get("--pyodide-dir") ?? process.env.R3_PYODIDE_DIR;
const manifest = JSON.parse(await readFile(resolve(repoRoot, "docs/r3-bot-limit-manifest.json"), "utf8"));
const artifactManifest = JSON.parse(await readFile(resolve(repoRoot, "docs/r3-runtime-artifacts.json"), "utf8"));
const runtimeMemoryPages = manifest.limits.wasmMemoryPages;
const outputLimitBytes = manifest.limits.outputBytes;
const browserPath = cliArgs.get("--browser") ?? process.env.R3_BROWSER ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const requirePass = process.argv.includes("--require-pass");
const requiredAssets = ["pyodide.mjs", "pyodide.asm.js", "pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json"];

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
if (pyodideDir && (await exists(pyodideDir)) && (await exists(browserPath)) && (await Promise.all(requiredAssets.map((asset) => exists(join(pyodideDir, asset))))).every(Boolean)) {
  for (const asset of requiredAssets) {
    const expectedSha256 = artifactManifest.artifacts?.pyodide?.assets?.[asset]?.sha256;
    const actualSha256 = await sha256(join(pyodideDir, asset));
    if (!expectedSha256 || actualSha256.toLowerCase() !== expectedSha256.toLowerCase()) {
      artifactHashMismatches.push({ artifact: asset, expectedSha256: expectedSha256 ?? null, actualSha256 });
    }
  }
}

if (!pyodideDir || !(await exists(pyodideDir)) || !(await exists(browserPath)) || !(await Promise.all(requiredAssets.map((asset) => exists(join(pyodideDir, asset))))).every(Boolean)) {
  console.log(JSON.stringify(missingReport("Provide --pyodide-dir with the pinned self-hosted assets and --browser with an installed browser."), null, 2));
  if (requirePass) process.exitCode = 2;
} else if (artifactHashMismatches.length > 0) {
  console.log(JSON.stringify({
    ...missingReport("Pinned Pyodide asset hash mismatch; browser/runtime was not started."),
    artifactHashMismatches,
  }, null, 2));
  if (requirePass) process.exitCode = 3;
} else {
  const mimeTypes = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".mjs": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".wasm": "application/wasm",
    ".zip": "application/zip",
  };
  const indexHtml = `<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; connect-src 'none'; worker-src 'self'; child-src 'self' http://localhost:*; object-src 'none'; base-uri 'none'"><title>R3 Pyodide probe</title><script src="/probe-parent.js"></script>`;
  const parentProbeJs = `
    window.__swReady = false;
    navigator.serviceWorker.register('/sw.js').then(() => navigator.serviceWorker.ready).then(() => { window.__swReady = true; });
    window.runPython = (source, timeoutMs = 10000) => new Promise((resolve) => {
      const worker = new Worker('/worker.js', { type: 'module' });
      const startedAt = performance.now();
      let readyAt = null;
      let computeTimer = null;
      const bootTimer = setTimeout(() => { worker.terminate(); resolve({ ok: false, timeout: true, timeoutPhase: 'boot', elapsedMs: Math.round(performance.now() - startedAt) }); }, 15000);
      const finish = (payload) => {
        clearTimeout(bootTimer);
        if (computeTimer) clearTimeout(computeTimer);
        worker.terminate();
        const finishedAt = performance.now();
        resolve({ ...payload, elapsedMs: Math.round(finishedAt - startedAt), bootElapsedMs: readyAt === null ? null : Math.round(readyAt - startedAt), computeElapsedMs: readyAt === null ? null : Math.round(finishedAt - readyAt) });
      };
      worker.onmessage = (event) => {
        if (event.data?.kind === 'ready') {
          readyAt = performance.now();
          computeTimer = setTimeout(() => finish({ ok: false, timeout: true, timeoutPhase: 'compute' }), timeoutMs);
          return;
        }
        finish(event.data);
      };
      worker.onerror = (event) => { console.error('worker-error', event.message, event.filename, event.lineno, event.colno); finish({ ok: false, error: String(event.message || event.error?.stack || 'worker error'), filename: event.filename, lineno: event.lineno, colno: event.colno }); };
      worker.postMessage({ source });
    });
    window.runCapabilities = () => new Promise((resolve) => {
      const worker = new Worker('/worker.js', { type: 'module' });
      const timer = setTimeout(() => { worker.terminate(); resolve({ ok: false, timeout: true }); }, 10000);
      worker.onmessage = (event) => { clearTimeout(timer); worker.terminate(); resolve(event.data); };
      worker.onerror = (event) => { console.error('capability-worker-error', event.message, event.filename, event.lineno, event.colno); clearTimeout(timer); worker.terminate(); resolve({ ok: false, error: String(event.message || event.error?.stack || 'worker error'), filename: event.filename, lineno: event.lineno, colno: event.colno }); };
      worker.postMessage({ kind: 'capabilities' });
    });
    window.runOpaqueProbe = (request = { kind: 'capabilities' }, timeoutMs = 20000) => new Promise((resolve) => {
      const frame = document.createElement('iframe');
      frame.setAttribute('sandbox', 'allow-scripts allow-same-origin');
      // Use localhost while the parent uses 127.0.0.1: same server, distinct
      // origin. This preserves module-worker support while proving the Bot
      // compartment cannot read the app origin's credentials or DOM.
      frame.src = location.protocol + '//localhost:' + location.port + '/opaque.html';
      frame.hidden = true;
      let computeTimer = null;
      const finish = (payload) => {
        clearTimeout(timer);
        if (computeTimer) clearTimeout(computeTimer);
        frame.remove();
        resolve({ ...payload, eventOrigin: frame.src ? new URL(frame.src).origin : null });
      };
      const timer = setTimeout(() => { frame.remove(); resolve({ ok: false, timeout: true, timeoutPhase: 'frame' }); }, timeoutMs);
      const onMessage = (event) => {
        if (event.source !== frame.contentWindow) return;
        if (event.data?.kind === 'frame-ready') {
          frame.contentWindow.postMessage(request, '*');
          return;
        }
        if (event.data?.kind === 'ready') {
          computeTimer = setTimeout(() => finish({ ok: false, timeout: true, timeoutPhase: 'compute' }), request.timeoutMs ?? 10000);
          return;
        }
        clearTimeout(timer);
        window.removeEventListener('message', onMessage);
        finish({ ...event.data, eventOrigin: event.origin });
      };
      window.addEventListener('message', onMessage);
      document.body.append(frame);
    });
    window.runOpaqueCapabilities = () => window.runOpaqueProbe({ kind: 'capabilities' });
  `;
  const opaqueHtml = `<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; worker-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'"><script src="/opaque-frame.js"></script>`;
  const opaqueFrameJs = `
    const parentReadable = (() => { try { void parent.location.href; return true; } catch { return false; } })();
    let storageUnavailable = false;
    try { void localStorage.length; } catch { storageUnavailable = true; }
    const worker = new Worker('/opaque-worker.js', { type: 'module' });
    const finish = (payload) => parent.postMessage({ ...payload, frameOrigin: location.origin, cookie: document.cookie, parentReadable, storageUnavailable }, '*');
    worker.onmessage = (event) => finish(event.data);
    worker.onerror = (event) => { console.error('opaque-worker-error', event.message, event.filename, event.lineno, event.colno); finish({ kind: 'result', ok: false, error: String(event.message || 'opaque worker error') }); };
    window.addEventListener('message', (event) => { if (event.source === parent) worker.postMessage(event.data); });
    parent.postMessage({ kind: 'frame-ready', frameOrigin: location.origin }, '*');
  `;
  const opaqueWorkerJs = `import { loadPyodide } from '/pyodide/pyodide.mjs';
    const deny = () => { throw new Error('capability disabled'); };
    function lockCapabilities() {
      Object.defineProperty(self, 'fetch', { configurable: false, writable: false, value: deny });
      Object.defineProperty(self, 'XMLHttpRequest', { configurable: false, writable: false, value: undefined });
      Object.defineProperty(self, 'WebSocket', { configurable: false, writable: false, value: undefined });
      try { Object.defineProperty(self, 'indexedDB', { configurable: false, writable: false, value: undefined }); } catch {}
      try { Object.defineProperty(self, 'caches', { configurable: false, writable: false, value: undefined }); } catch {}
      try { Object.defineProperty(self, 'cookieStore', { configurable: false, writable: false, value: undefined }); } catch {}
    }
    function lockPythonBridge(pyodide) {
      pyodide.runPython("import builtins\\ndef _ott_make_import_guard(original_import):\\n    def _ott_guarded_import(name, globals=None, locals=None, fromlist=(), level=0):\\n        if name in ('js', 'pyodide_js', 'pyodide', 'builtins'):\\n            raise ImportError('capability disabled')\\n        return original_import(name, globals, locals, fromlist, level)\\n    return _ott_guarded_import\\nbuiltins.__import__ = _ott_make_import_guard(builtins.__import__)\\ndel _ott_make_import_guard");
    }
    self.onmessage = async (event) => {
      try {
        const wasmMemory = new WebAssembly.Memory({ initial: 320, maximum: ${runtimeMemoryPages} });
        const pyodide = await loadPyodide({ indexURL: '/pyodide/', jsglobals: Object.freeze({}), wasmMemory });
        lockCapabilities();
        const jsBridge = JSON.parse(pyodide.runPython("import json, js\\njson.dumps({key: hasattr(js, key) for key in ['fetch', 'indexedDB', 'caches', 'cookieStore', 'document', 'window', 'Worker', 'Blob']})"));
        lockPythonBridge(pyodide);
        if (event.data?.kind === 'probe') {
          self.postMessage({ kind: 'ready' });
          const result = pyodide.runPython(event.data.source);
          const resultText = String(result ?? '');
          const resultBytes = new TextEncoder().encode(resultText).byteLength;
          if (resultBytes > ${outputLimitBytes}) {
            self.postMessage({ kind: 'result', ok: false, outputExceeded: true, outputBytes: resultBytes });
          } else {
            self.postMessage({ kind: 'result', ok: true, result: resultText });
          }
          return;
        }
        let networkDenied = false;
        try { await fetch('https://example.com/'); } catch { networkDenied = true; }
        const importDenied = {};
        for (const moduleName of ['js', 'pyodide_js', 'pyodide', 'builtins']) {
          try { pyodide.runPython('import ' + moduleName); importDenied[moduleName] = false; } catch { importDenied[moduleName] = true; }
        }
        self.postMessage({ kind: 'result', ok: true, workerOrigin: self.location.origin, networkDenied, document: typeof document, window: typeof window, fetchLocked: Object.getOwnPropertyDescriptor(self, 'fetch')?.configurable === false, jsBridge, importDenied });
      } catch (error) { self.postMessage({ kind: 'result', ok: false, error: String(error?.stack || error) }); }
    };
  `;
  const workerJs = `import { loadPyodide } from '/pyodide/pyodide.mjs';
    const deny = () => { throw new Error('capability disabled'); };
    function lockCapabilities() {
      Object.defineProperty(self, 'fetch', { configurable: false, writable: false, value: deny });
      Object.defineProperty(self, 'XMLHttpRequest', { configurable: false, writable: false, value: undefined });
      Object.defineProperty(self, 'WebSocket', { configurable: false, writable: false, value: undefined });
      try { Object.defineProperty(self, 'indexedDB', { configurable: false, writable: false, value: undefined }); } catch {}
      try { Object.defineProperty(self, 'caches', { configurable: false, writable: false, value: undefined }); } catch {}
      try { Object.defineProperty(self, 'cookieStore', { configurable: false, writable: false, value: undefined }); } catch {}
    }
    function lockPythonBridge(pyodide) {
      pyodide.runPython("import builtins\\ndef _ott_make_import_guard(original_import):\\n    def _ott_guarded_import(name, globals=None, locals=None, fromlist=(), level=0):\\n        if name in ('js', 'pyodide_js', 'pyodide', 'builtins'):\\n            raise ImportError('capability disabled')\\n        return original_import(name, globals, locals, fromlist, level)\\n    return _ott_guarded_import\\nbuiltins.__import__ = _ott_make_import_guard(builtins.__import__)\\ndel _ott_make_import_guard");
    }
    self.onmessage = async (event) => {
      try {
        const wasmMemory = new WebAssembly.Memory({ initial: 320, maximum: ${runtimeMemoryPages} });
        const pyodide = await loadPyodide({ indexURL: '/pyodide/', jsglobals: Object.freeze({}), wasmMemory });
        lockCapabilities();
        const jsBridge = event.data.kind === 'capabilities'
          ? JSON.parse(pyodide.runPython("import json, js\\njson.dumps({key: hasattr(js, key) for key in ['fetch', 'indexedDB', 'caches', 'cookieStore', 'document', 'window', 'Worker', 'Blob']})"))
          : null;
        lockPythonBridge(pyodide);
        if (event.data.kind === 'capabilities') {
          let networkDenied = false;
          try { await fetch('https://example.com/'); } catch { networkDenied = true; }
          const fetchDescriptor = Object.getOwnPropertyDescriptor(self, 'fetch');
          const importDenied = {};
          for (const moduleName of ['js', 'pyodide_js', 'pyodide', 'builtins']) {
            try { pyodide.runPython('import ' + moduleName); importDenied[moduleName] = false; } catch { importDenied[moduleName] = true; }
          }
          const guardAliasExposed = JSON.parse(pyodide.runPython("import json\\njson.dumps('_ott_original_import' in locals())")) === true;
          const memory = wasmMemory;
          let memoryLocked = false;
          if (memory) {
            const initialPages = memory.buffer.byteLength / 65536;
            try {
              memory.grow(${runtimeMemoryPages} - initialPages);
              memory.grow(1);
            } catch {
              memoryLocked = true;
            }
          }
          self.postMessage({ ok: true, networkDenied, indexedDB: typeof indexedDB, caches: typeof caches, cookieStore: typeof cookieStore, document: typeof document, window: typeof window, fetchLocked: fetchDescriptor?.configurable === false && fetchDescriptor?.writable === false, jsBridge, importDenied, guardAliasExposed, memoryLocked, memoryPages: ${runtimeMemoryPages} });
          return;
        }
        self.postMessage({ kind: 'ready' });
        const result = pyodide.runPython(event.data.source);
        const resultText = String(result ?? '');
        const resultBytes = new TextEncoder().encode(resultText).byteLength;
        if (resultBytes > ${outputLimitBytes}) {
          self.postMessage({ kind: 'result', ok: false, outputExceeded: true, outputBytes: resultBytes });
          return;
        }
        self.postMessage({ kind: 'result', ok: true, result: resultText });
      } catch (error) {
        self.postMessage({ kind: 'result', ok: false, error: String(error?.stack || error) });
      }
    }`;
  const serviceWorkerJs = `const CACHE = 'ott-v2-r3-pyodide-0.27.3';
    const ASSETS = ['/index.html', '/probe-parent.js', '/worker.js', '/pyodide/pyodide.mjs', '/pyodide/pyodide.asm.js', '/pyodide/pyodide.asm.wasm', '/pyodide/python_stdlib.zip', '/pyodide/pyodide-lock.json'];
    self.addEventListener('install', (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())));
    self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
    self.addEventListener('fetch', (event) => event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request))));`;
  const parentCsp = "default-src 'self'; script-src 'self'; connect-src 'none'; worker-src 'self'; child-src 'self' http://localhost:*; object-src 'none'; base-uri 'none'";
  const workerCsp = "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'; worker-src 'none'; child-src 'none'; object-src 'none'; base-uri 'none'";
  let requestCount = 0;
  const requestLog = [];
  const server = createServer(async (request, response) => {
    requestCount += 1;
    const requestPath = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
    requestLog.push(requestPath);
    if (requestPath === "/index.html" || requestPath === "/") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache", "content-security-policy": parentCsp });
      response.end(indexHtml);
      return;
    }
    if (requestPath === "/probe-parent.js") {
      response.writeHead(200, { "content-type": "application/javascript; charset=utf-8", "cache-control": "no-cache", "content-security-policy": parentCsp });
      response.end(parentProbeJs);
      return;
    }
    if (requestPath === "/opaque.html") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache", "content-security-policy": "default-src 'none'; script-src 'self'; worker-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'" });
      response.end(opaqueHtml);
      return;
    }
    if (requestPath === "/opaque-frame.js") {
      response.writeHead(200, { "content-type": "application/javascript; charset=utf-8", "cache-control": "no-cache", "access-control-allow-origin": "*" });
      response.end(opaqueFrameJs);
      return;
    }
    if (requestPath === "/opaque-worker.js") {
      response.writeHead(200, { "content-type": "application/javascript; charset=utf-8", "cache-control": "no-cache", "content-security-policy": workerCsp, "access-control-allow-origin": "*" });
      response.end(opaqueWorkerJs);
      return;
    }
    if (requestPath === "/worker.js") {
      response.writeHead(200, { "content-type": "application/javascript; charset=utf-8", "cache-control": "public, max-age=31536000", "content-security-policy": workerCsp });
      response.end(workerJs);
      return;
    }
    if (requestPath === "/sw.js") {
      response.writeHead(200, { "content-type": "application/javascript; charset=utf-8", "cache-control": "no-cache" });
      response.end(serviceWorkerJs);
      return;
    }
    if (requestPath.startsWith("/pyodide/")) {
      const asset = requestPath.slice("/pyodide/".length);
      if (asset.includes("..") || !requiredAssets.includes(asset)) {
        response.writeHead(404);
        response.end();
        return;
      }
      const assetPath = join(pyodideDir, asset);
      response.writeHead(200, { "content-type": mimeTypes[extname(asset)] ?? "application/octet-stream", "cache-control": "public, max-age=31536000, immutable", "access-control-allow-origin": "*" });
      createReadStream(assetPath).pipe(response);
      return;
    }
    if (requestPath === "/favicon.ico") {
      response.writeHead(204);
      response.end();
      return;
    }
    response.writeHead(404);
    response.end();
  });
  await new Promise((resolvePromise) => server.listen(0, "127.0.0.1", resolvePromise));
  const address = server.address();
  const origin = `http://127.0.0.1:${address.port}`;
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ executablePath: browserPath, headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const diagnostics = [];
  page.on('console', (message) => diagnostics.push({ type: message.type(), text: message.text() }));
  page.on('pageerror', (error) => diagnostics.push({ type: 'pageerror', text: String(error) }));
  const fixture = "import json\nstate = {'turn': 'BLUE', 'legalMoves': [{'from': 'a1', 'to': 'b2'}]}\njson.dumps({'move': state['legalMoves'][0], 'memory': {'seen': 1}}, separators=(',', ':'))";
  const fixtureResult = '{"move":{"from":"a1","to":"b2"},"memory":{"seen":1}}';
  const deterministic = "import json\nstate = {'legalMoves': [{'from': 'a1', 'to': 'b2'}, {'from': 'a1', 'to': 'a2'}]}\ndef choose_move(seed, state):\n    return {'seed': seed, 'move': state['legalMoves'][seed % len(state['legalMoves'])]}\njson.dumps(choose_move(42, state), separators=(',', ':'))";
  const alternateDeterministic = deterministic.replace("choose_move(42, state)", "choose_move(43, state)");
  const outputFlood = "import json\njson.dumps('x' * 20000)";
  const infiniteLoop = "while True:\n    pass";
  let warm = null;
  let offline = null;
  let deterministicA = null;
  let deterministicB = null;
  let deterministicC = null;
  let flood = null;
  let watchdog = null;
  let capabilities = null;
  let opaqueCapabilities = null;
  let opaqueWarm = null;
  let opaqueDeterministicA = null;
  let opaqueDeterministicB = null;
  let opaqueFlood = null;
  let opaqueWatchdog = null;
  let offlineNavigationError = null;
  try {
    await page.goto(`${origin}/index.html`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__swReady === true, null, { timeout: 30000 });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__swReady === true, null, { timeout: 30000 });
    capabilities = await page.evaluate(() => window.runCapabilities());
    opaqueCapabilities = await page.evaluate(() => window.runOpaqueCapabilities());
    opaqueWarm = await page.evaluate((source) => window.runOpaqueProbe({ kind: 'probe', source }), fixture);
    opaqueDeterministicA = await page.evaluate((source) => window.runOpaqueProbe({ kind: 'probe', source }), deterministic);
    opaqueDeterministicB = await page.evaluate((source) => window.runOpaqueProbe({ kind: 'probe', source }), deterministic);
    opaqueFlood = await page.evaluate((source) => window.runOpaqueProbe({ kind: 'probe', source }), outputFlood);
    opaqueWatchdog = await page.evaluate((source) => window.runOpaqueProbe({ kind: 'probe', source, timeoutMs: 500 }), infiniteLoop);
    warm = await page.evaluate((source) => window.runPython(source), fixture);
    deterministicA = await page.evaluate((source) => window.runPython(source), deterministic);
    deterministicB = await page.evaluate((source) => window.runPython(source), deterministic);
    deterministicC = await page.evaluate((source) => window.runPython(source), alternateDeterministic);
    flood = await page.evaluate((source) => window.runPython(source), outputFlood);
    watchdog = await page.evaluate((source) => window.runPython(source, 500), infiniteLoop);
    const offlinePage = await context.newPage();
    try {
      await offlinePage.goto(`${origin}/index.html`, { waitUntil: "domcontentloaded", timeout: 10000 });
      await offlinePage.waitForFunction(() => window.__swReady === true, null, { timeout: 10000 });
      await offlinePage.reload({ waitUntil: "domcontentloaded", timeout: 10000 });
      await offlinePage.waitForFunction(() => window.__swReady === true, null, { timeout: 10000 });
      const requestCountBeforeOffline = requestCount;
      const requestLogLengthBeforeOffline = requestLog.length;
      await context.setOffline(true);
      await offlinePage.reload({ waitUntil: "domcontentloaded", timeout: 10000 });
      await offlinePage.waitForFunction(() => window.__swReady === true, null, { timeout: 10000 });
      offline = await offlinePage.evaluate((source) => window.runPython(source), fixture);
      offline.requestCountDelta = requestCount - requestCountBeforeOffline;
      offline.runtimeRequestDelta = requestLog.slice(requestLogLengthBeforeOffline).filter((path) => path.startsWith("/pyodide/")).length;
    } catch (error) {
      offlineNavigationError = String(error);
    } finally {
      await offlinePage.close();
    }
    offline = offline ?? { ok: false, error: offlineNavigationError };
    await context.setOffline(false);
  } finally {
    await context.close();
    await browser.close();
    await new Promise((resolvePromise) => server.close(resolvePromise));
  }
  let warmValue = null;
  try {
    warmValue = warm?.ok === true ? JSON.parse(warm.result) : null;
  } catch {
    warmValue = null;
  }
  const warmPass = warm?.ok === true && warmValue?.move?.from === "a1";
  const offlinePass = offline?.ok === true && offline.runtimeRequestDelta === 0;
  const deterministicPass = deterministicA?.ok === true && deterministicB?.ok === true && deterministicC?.ok === true && deterministicA.result === deterministicB.result && deterministicA.result !== deterministicC.result;
  const outputBudgetPass = flood?.ok === false && flood.outputExceeded === true && flood.outputBytes > outputLimitBytes;
  const watchdogPass = watchdog?.timeout === true;
  const opaqueWarmPass = opaqueWarm?.ok === true && opaqueWarm.result === fixtureResult;
  const opaqueDeterministicPass = opaqueDeterministicA?.ok === true
    && opaqueDeterministicB?.ok === true
    && opaqueDeterministicA.result === opaqueDeterministicB.result;
  const opaqueOutputBudgetPass = opaqueFlood?.ok === false && opaqueFlood.outputExceeded === true && opaqueFlood.outputBytes > outputLimitBytes;
  const opaqueWatchdogPass = opaqueWatchdog?.timeout === true && opaqueWatchdog.timeoutPhase === 'compute';
  const capabilitiesPass = capabilities?.ok === true
    && capabilities.networkDenied === true
    && capabilities.indexedDB === 'undefined'
    && capabilities.caches === 'undefined'
    && capabilities.cookieStore === 'undefined'
    && capabilities.document === 'undefined'
    && capabilities.window === 'undefined'
    && capabilities.fetchLocked === true
    && capabilities.memoryLocked === true
    && capabilities.memoryPages === runtimeMemoryPages
    && Object.values(capabilities.jsBridge ?? {}).every((value) => value === false)
    && Object.values(capabilities.importDenied ?? {}).every((value) => value === true)
    && capabilities.guardAliasExposed === false;
  const parentOrigin = `http://127.0.0.1:${new URL(origin).port}`;
  const opaqueCompartmentPass = opaqueCapabilities?.ok === true
    && typeof opaqueCapabilities.eventOrigin === "string"
    && opaqueCapabilities.eventOrigin !== parentOrigin
    && opaqueCapabilities.frameOrigin === opaqueCapabilities.eventOrigin
    && opaqueCapabilities.workerOrigin === opaqueCapabilities.eventOrigin
    && opaqueCapabilities.parentReadable === false
    && opaqueCapabilities.cookie === ""
    && opaqueCapabilities.networkDenied === true
    && opaqueCapabilities.document === "undefined"
    && opaqueCapabilities.window === "undefined"
    && opaqueCapabilities.fetchLocked === true
    && Object.values(opaqueCapabilities.jsBridge ?? {}).every((value) => value === false)
    && Object.values(opaqueCapabilities.importDenied ?? {}).every((value) => value === true);
  const allPass = warmPass && offlinePass && deterministicPass && outputBudgetPass && watchdogPass && capabilitiesPass && opaqueCompartmentPass && opaqueWarmPass && opaqueDeterministicPass && opaqueOutputBudgetPass && opaqueWatchdogPass;
  const assets = {};
  for (const asset of requiredAssets) assets[asset] = { bytes: (await stat(join(pyodideDir, asset))).size, sha256: await sha256(join(pyodideDir, asset)) };
  const report = {
    measuredAt: new Date().toISOString(),
    runtimeGate: allPass ? "PROVEN_FOR_PYODIDE_MODULE_WORKER_PROBE" : "NOT_PROVEN",
    fixtureCodeExecuted: warm?.ok === true || offline?.ok === true,
    playerCodeExecuted: false,
    runtime: { pyodideVersion: "0.27.3", browserPath, assets },
    checks: {
      warmWorkerAbi: { pass: warmPass, result: warm },
      offlineColdWorker: { pass: offlinePass, result: offline },
      deterministicSeed: { pass: deterministicPass, first: deterministicA?.result ?? null, second: deterministicB?.result ?? null, alternateSeed: deterministicC?.result ?? null },
      outputBudget: { pass: outputBudgetPass, outputBytes: flood?.outputBytes ?? null, terminated: flood?.outputExceeded === true, limit: outputLimitBytes },
      watchdogTerminate: { pass: watchdogPass, result: watchdog },
      capabilityDeny: { pass: capabilitiesPass, result: capabilities },
      crossOriginCompartment: { pass: opaqueCompartmentPass, result: { ...opaqueCapabilities, parentOrigin } },
      crossOriginFixtures: {
        pass: opaqueWarmPass && opaqueDeterministicPass && opaqueOutputBudgetPass && opaqueWatchdogPass,
        abi: { pass: opaqueWarmPass, result: opaqueWarm },
        deterministic: { pass: opaqueDeterministicPass, sameResult: opaqueDeterministicA?.result === opaqueDeterministicB?.result },
        outputBudget: { pass: opaqueOutputBudgetPass, outputBytes: opaqueFlood?.outputBytes ?? null, limit: outputLimitBytes },
        watchdog: { pass: opaqueWatchdogPass, result: opaqueWatchdog },
      },
    },
    diagnostics,
  };
  console.log(JSON.stringify(report, null, 2));
  if (requirePass && !allPass) process.exitCode = 1;
}
