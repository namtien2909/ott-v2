import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const manifest = JSON.parse(await readFile(new URL("../docs/r3-runtime-artifacts.json", import.meta.url), "utf8"));

test("every runtime SHA-256 pin contains exactly 64 hexadecimal characters", () => {
  function check(value, path = "manifest") {
    for (const [key, entry] of Object.entries(value)) {
      if (entry && typeof entry === "object") check(entry, `${path}.${key}`);
      else if (key.toLowerCase().includes("sha256")) {
        assert.match(entry, /^[a-f0-9]{64}$/, `${path}.${key}`);
      }
    }
  }
  check(manifest);
});

test("Wasmtime Linux archive matches the independently downloaded release digest", () => {
  assert.equal(manifest.artifacts.wasmtime.linuxArchiveSha256,
    "a4d6e9e3a5a60f527cf7793d674c48930c80c2e8977995b8a275cad3254b9322");
});
