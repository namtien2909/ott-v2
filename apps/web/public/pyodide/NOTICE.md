# Runtime asset notices

These self-hosted assets are pinned for the OTT v2 R3 Offline compatibility probe.

- Pyodide 0.27.3 — MPL-2.0: https://github.com/pyodide/pyodide
- CPython 3.12 standard library included by this Pyodide build — Python Software Foundation License 2.0: https://www.python.org/psf/license/
- Wasmtime probe attribution (Apache-2.0 WITH LLVM-exception) and CPython-WASI build attribution (MIT) are included for the pinned R3 runtime family.

The complete pinned license texts are shipped beside this notice in `licenses/` and are also checked in under `docs/licenses/`. Release hashes and the artifact boundary are recorded in `docs/r3-runtime-artifacts.json` and `docs/r3-runtime-notices.md`. Optional packages listed in `pyodide-lock.json` are not part of this checked-in core/stdlib bundle.
