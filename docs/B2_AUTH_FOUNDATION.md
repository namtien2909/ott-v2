# B2 — Auth / Session / Recovery

**Status:** Complete for the B2 scope  
**Date:** 2026-09-28  
**Depends on:** B0 foundation, B1 shared tokens/ambient/audio

## Delivered output

- Login, Register, Forgot Password and Recovery Code now share the B1 Arena token/font/glass language.
- Auth card is a 420–520px frosted-glass surface with safe-area padding, cyan/aurora edge, readable hierarchy and responsive 375×812 behavior.
- Labels remain visible and associated with stable input IDs. Password fields keep an accessible show/hide control and hint association.
- Login/Register/Forgot perform client-side validation before network calls. Errors render beside the relevant field with `aria-invalid`, `aria-describedby`, `role=status` or `role=alert` as appropriate.
- Submit controls use the existing pending lock; duplicate submits are prevented while requests are in flight.
- Recovery Code is shown only in the in-memory post-register state, inside a hologram card. Copy uses the Clipboard API with an explicit manual-copy fallback. Continue remains keyboard-inaccessible until the user confirms the code is saved.
- Forgot Password accepts username + Recovery Code (not email), normalizes the code to uppercase and gives a live success handoff back to Login.
- Reduced Motion disables the recovery scanline and existing auth motion.

## Evidence

```text
corepack pnpm --filter @ottv2/web typecheck
corepack pnpm --filter @ottv2/web test -- --run
corepack pnpm --filter @ottv2/web lint
corepack pnpm --filter @ottv2/web build
```

- Typecheck: passed.
- Frontend tests: 8 files / 22 tests passed, including `src/pages/AuthPages.test.tsx`.
- ESLint: passed with `--max-warnings 0`.
- Production build: passed. Only third-party Zod annotation warnings remain.

## Not in B2

Auth API/server semantics remain owned by the existing auth contract. B2 does not change username rules, recovery-code generation, session persistence or backend error codes. Auth visual regression on physical Safari/Android is carried into B13 device QA.
