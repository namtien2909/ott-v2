import assert from "node:assert/strict";
import { test } from "node:test";
import { describeRuntimeStartup } from "./r3-runtime-startup.mjs";

test("runtime startup distinguishes host timeout, loader failure and guest quota", () => {
  assert.equal(describeRuntimeStartup({ hostTimedOut: true }).cause, "HOST_STARTUP_TIMEOUT");
  assert.equal(describeRuntimeStartup({ stderr: "GLIBC_2.28 not found" }).cause, "GLIBC_VERSION_UNAVAILABLE");
  assert.equal(describeRuntimeStartup({ stderr: "all fuel consumed" }).cause, "GUEST_BUDGET_EXCEEDED");
});

test("runtime startup keeps a provider process abort separate from guest quota", () => {
  assert.equal(describeRuntimeStartup({ code: 134, signal: null, stderr: "all fuel consumed" }).cause, "GUEST_BUDGET_EXCEEDED");
  assert.equal(describeRuntimeStartup({ code: 134, signal: null, stderr: "" }).cause, "HOST_PROCESS_ABORTED");
});

test("runtime startup diagnostics do not expose raw output or private paths", () => {
  const result = describeRuntimeStartup({ code: 1, stderr: "/private/path: error while loading shared libraries; secret=private-value" });
  assert.equal(result.cause, "SHARED_LIBRARY_UNAVAILABLE");
  assert.ok(!JSON.stringify(result).includes("private"));
});
