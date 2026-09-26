# Load and benchmark tests

k6 is the selected load runner. Install a pinned k6 release in the execution environment and record its version with every report. W0 defines the location and reproducibility rules only; it makes no capacity claim.

Future scenarios read target URLs and workload settings from environment variables. Every stored report must include the date, commit/version, server and database resources, test-client environment, k6 version, and workload configuration.

Suggested invocation once a real scenario exists:

```sh
k6 run -e BASE_URL=http://localhost:3000 tests/load/scenarios/<scenario>.js
```
