# Engine checks

Three layers, no extra dependencies. Build the engine first (`pnpm build`); every script below does it.

| Command | What runs |
| --- | --- |
| `pnpm test:unit` | `node --test tests/unit/*.test.ts` against `dist/`: reducer, group measurement, fallback selection, resources, persistent registry. |
| `pnpm test:browser` | `examples/basic/tests/harness` in headless Chrome over the DevTools protocol: lifecycle order and shared timeline, fallback per direction, scopes/cleanup, groups/labels/ready latch, first load, resources, interruption, inert, persistent recipes, the README's recommended snippets, `debug.retainPages`, `debug.devTools`. |
| `pnpm test:prod-debug` | Production build of `examples/basic` with both debug flags forced on, then asserts the client assets contain the engine and no GSDevTools code. |
| `pnpm test` | All three. |

Browser runner options: `CHROME_PATH` (Chrome binary), `HARNESS_URL` (reuse a running harness server), `HARNESS_TIMEOUT` (ms), `--only <substring>` (filter checks by name). The harness can also be opened by hand: `cd examples/basic && pnpm exec vite --config tests/harness/vite.config.ts` → http://localhost:5199/ prints a JSON report and sets the document title to PASS/FAIL.

Not covered here: reduced motion (only mirrored, not emulated), SSR/hydration of the first page, React StrictMode (the harness mounts without it; `examples/basic` runs with it), and application-specific scene, scroll and choreography checks, which belong to each consuming application.
