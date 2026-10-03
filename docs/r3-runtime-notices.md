# R3 runtime notices

R3 pins the following free, self-hosted runtime artifacts for compatibility probes. These notices are attribution and provenance only; they do not grant permission to execute arbitrary player code in production.

| Artifact | Version | License | Source / license reference |
|---|---:|---|---|
| Wasmtime | 49.0.2 | Apache-2.0 WITH LLVM-exception | [bytecodealliance/wasmtime](https://github.com/bytecodealliance/wasmtime) |
| CPython WASI runtime | 3.14.7 | Python Software Foundation License 2.0 | [brettcannon/cpython-wasi-build](https://github.com/brettcannon/cpython-wasi-build) |
| CPython WASI build repository | 3.14.7 | MIT | [build repository](https://github.com/brettcannon/cpython-wasi-build) |
| Pyodide | 0.27.3 | MPL-2.0 | [pyodide/pyodide](https://github.com/pyodide/pyodide) |

The exact release URLs, archive hashes, checked-in asset hashes and the boundary of the probe are recorded in [`r3-runtime-artifacts.json`](./r3-runtime-artifacts.json). Full license texts for the pinned runtime families are checked in under [`licenses/`](./licenses/): Apache-2.0 with the Wasmtime LLVM exception, MPL-2.0 (Pyodide), PSF-2.0 (CPython/stdlib) and MIT (the CPython-WASI build repository). The same texts are copied into `apps/web/public/pyodide/licenses/` for the self-hosted public bundle. The bundle contains only the Pyodide core/stdlib assets listed in the manifest; optional packages in `pyodide-lock.json` are not shipped or installable by the Bot runner, so their notices are outside this artifact boundary.
