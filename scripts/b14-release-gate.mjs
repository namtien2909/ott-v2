import { gzipSync } from "node:zlib";
import { readFile, readdir, stat } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";

const root = process.cwd();
const errors = [];
const notes = [];
const fail = (message) => errors.push(message);
const exists = async (path) => { try { await stat(path); return true; } catch { return false; } };

async function walk(directory) {
  if (!(await exists(directory))) return [];
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else files.push(path);
  }
  return files;
}

const sourceRoot = resolve(root, "apps/web/src");
const sourceFiles = (await walk(sourceRoot)).filter((file) => /\.(tsx?|css)$/.test(file));
const sourceText = (await Promise.all(sourceFiles.map((file) => readFile(file, "utf8")))).join("\n");
const emojiFiles = [];
for (const file of sourceFiles) {
  const text = await readFile(file, "utf8");
  if ([...text].some((character) => { const code = character.codePointAt(0) ?? 0; return (code >= 0x1f300 && code <= 0x1faff) || (code >= 0x2600 && code <= 0x27bf); })) emojiFiles.push(relative(root, file));
}
if (emojiFiles.length) fail(`emoji/UI symbol decoration remains in source: ${emojiFiles.join(", ")}`);
if (/getContext\(["']webgl|<video\b/i.test(sourceText)) fail("WebGL/video rendering is present without an approved justification.");

const routesText = await readFile(resolve(root, "apps/web/src/app/routes.ts"), "utf8");
for (const route of ["/", "/dang-nhap", "/dang-ky", "/quen-mat-khau", "/queue", "/game/:roomId", "/history", "/history/:matchId", "/profile/:username", "/friends", "/settings", "/guest", "/guest/play", "/ai", "/offline", "/spectate/:roomId"]) {
  if (!routesText.includes(`\"${route}\"`)) fail(`route inventory is missing ${route}`);
}

const setupText = await readFile(resolve(root, "packages/game-rules/src/setup.ts"), "utf8");
if (!/a1/.test(setupText) || !/i9/.test(setupText)) fail("canonical setup no longer contains the normal playable goal cells a1 and i9.");

const preferenceText = await readFile(resolve(root, "apps/web/src/services/presentation/preferences.ts"), "utf8");
for (const cue of ["ui_hover", "ui_click", "ui_confirm", "ui_error", "select", "move", "capture", "goal_warning", "low_time_tick", "match_found", "countdown_tick", "countdown_go", "victory", "defeat", "elo_tick", "rank_up"]) {
  if (!preferenceText.includes(`\"${cue}\"`)) fail(`synthesized SFX cue is missing: ${cue}`);
}
const attributionPath = resolve(root, "apps/web/public/audio/bgm/ATTRIBUTION.md");
if (!(await exists(attributionPath))) fail("audio attribution file is missing.");
else {
  const attribution = await readFile(attributionPath, "utf8");
  for (const track of ["lobby_loop.wav", "match_loop.wav"]) if (!attribution.includes(track)) fail(`audio attribution does not mention ${track}.`);
}

const publicAudio = (await walk(resolve(root, "apps/web/public/audio/bgm"))).filter((file) => extname(file).toLowerCase() !== ".md");
const audioBytes = (await Promise.all(publicAudio.map(async (file) => (await stat(file)).size))).reduce((sum, size) => sum + size, 0);
if (audioBytes > 5 * 1024 * 1024) fail(`BGM total is ${(audioBytes / 1024 / 1024).toFixed(2)} MB; limit is 5 MB.`);
for (const file of publicAudio) if ((await stat(file)).size > 5 * 1024 * 1024) fail(`BGM file exceeds 5 MB: ${relative(root, file)}`);

const distRoot = resolve(root, "apps/web/dist");
if (!(await exists(resolve(distRoot, "index.html")))) fail("apps/web/dist/index.html is missing; run the production build before the release gate.");
const distAssets = (await walk(resolve(distRoot, "assets"))).filter((file) => extname(file).toLowerCase() === ".js");
let totalJsGzip = 0;
let entryGzip = 0;
for (const file of distAssets) {
  const buffer = await readFile(file);
  const compressed = gzipSync(buffer).length;
  totalJsGzip += compressed;
  if (/index-[^/]+\.js$/.test(file)) entryGzip = Math.max(entryGzip, compressed);
}
if (entryGzip > 170 * 1024) fail(`initial JS entry is ${(entryGzip / 1024).toFixed(1)} KB gzip; limit is 170 KB.`);
if (totalJsGzip > 240 * 1024) fail(`all JS chunks total ${(totalJsGzip / 1024).toFixed(1)} KB gzip; limit is 240 KB.`);

const effectSources = [
  "apps/web/src/foundation/AmbientArena.tsx",
  "apps/web/src/foundation/eventBus.ts",
  "apps/web/src/foundation/qualityTier.ts",
  "apps/web/src/foundation/PresentationAudio.tsx",
  "apps/web/src/services/presentation/preferences.ts",
  "apps/web/src/components/result/ResultPanel.tsx",
].map((file) => resolve(root, file));
const effectGzip = gzipSync((await Promise.all(effectSources.map((file) => readFile(file, "utf8")))).join("\n")).length;
if (effectGzip > 60 * 1024) fail(`VFX/audio source budget is ${(effectGzip / 1024).toFixed(1)} KB gzip; limit is 60 KB.`);

if (errors.length) {
  console.error("B14 RELEASE GATE: FAIL");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log("B14 RELEASE GATE: PASS");
  console.log(`- route inventory: ${[...routesText.matchAll(/\b\w+:\s*\"[^\"]+\"/g)].length} entries audited`);
  console.log(`- initial JS: ${(entryGzip / 1024).toFixed(1)} KB gzip; total JS: ${(totalJsGzip / 1024).toFixed(1)} KB gzip`);
  console.log(`- VFX/audio source budget: ${(effectGzip / 1024).toFixed(1)} KB gzip`);
  console.log(`- BGM assets: ${(audioBytes / 1024).toFixed(1)} KB total; lazy tracks attributed`);
  if (notes.length) for (const note of notes) console.log(`- note: ${note}`);
}
