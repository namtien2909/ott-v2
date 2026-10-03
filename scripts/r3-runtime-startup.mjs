// Only classify fixed harness process failures. Never include raw process
// output, paths, environment values or Python source in public diagnostics.
export function describeRuntimeStartup(run) {
  const output = `${run.stderr ?? ""}\n${run.error ?? ""}`;
  const cause = run.hostTimedOut ? "HOST_STARTUP_TIMEOUT"
    : /GLIBC_[0-9.]+.*not found/.test(output) ? "GLIBC_VERSION_UNAVAILABLE"
    : /error while loading shared libraries/i.test(output) ? "SHARED_LIBRARY_UNAVAILABLE"
    : /ENOENT/.test(output) ? "EXECUTABLE_UNAVAILABLE"
    : /EACCES|permission denied/i.test(output) ? "EXECUTION_PERMISSION_DENIED"
    : /failed to spawn|Resource temporarily unavailable|thread.*panicked/i.test(output) ? "HOST_THREAD_RESOURCE_FAILURE"
    : /No module named|Could not find platform|encodings|init_fs_encoding/.test(output) ? "PYTHON_RUNTIME_LAYOUT_FAILURE"
    // Wasmtime CLI may use exit 134 for a normal guest trap, so inspect the
    // sanitized diagnostic class before treating 134 as a host abort.
    : /fuel|interrupt|timed out/i.test(output) ? "GUEST_BUDGET_EXCEEDED"
    // A provider process can abort before the guest budget is meaningfully
    // exercised (Linux commonly reports this as exit 134 with no signal).
    : run.code === 134 && run.signal == null ? "HOST_PROCESS_ABORTED"
    : run.signal === "SIGKILL" ? "HOST_PROCESS_KILLED"
    : run.code === 0 ? "OK" : "UNCLASSIFIED_STARTUP_FAILURE";
  return { cause, code: run.code, signal: run.signal, elapsedMs: run.elapsedMs, hostTimedOut: run.hostTimedOut };
}
