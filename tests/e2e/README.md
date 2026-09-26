# Browser E2E tests

Playwright is the browser E2E runner. Set `E2E_BASE_URL` to the running web application URL before execution. Browser E2E is scaffolded but is not a required W0 CI gate.

Do not encode server-authoritative game decisions in browser fixtures. Later tests must drive the public UI/API and assert observable convergence.
