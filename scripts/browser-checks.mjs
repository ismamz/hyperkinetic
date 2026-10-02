#!/usr/bin/env node
// Runs the engine browser harness (tests/browser) in headless Chrome and
// prints its results. No extra dependencies: the dev server is Vite, the
// browser is driven over the DevTools protocol with the WebSocket built into
// Node.
//
//   node scripts/browser-checks.mjs            # build engine first: pnpm build
//   HARNESS_URL=http://localhost:5199/ node scripts/browser-checks.mjs   # reuse a running server
//   CHROME_PATH=/path/to/chrome node scripts/browser-checks.mjs
//   node scripts/browser-checks.mjs --only resources

import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const port = 5199;
const onlyIndex = process.argv.indexOf("--only");
const only = onlyIndex > -1 ? process.argv[onlyIndex + 1] : null;
const timeoutMs = Number(process.env.HARNESS_TIMEOUT ?? 90_000);

const chromeCandidates = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean);
const chromePath = chromeCandidates.find((p) => existsSync(p));
if (!chromePath) {
  console.error("No Chrome found. Set CHROME_PATH.");
  process.exit(2);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const children = [];
// Children run in their own process group so killing them takes their own
// subprocesses (pnpm → vite, chrome → renderers) along.
const cleanup = () => {
  for (const child of children) {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      try {
        child.kill("SIGTERM");
      } catch {}
    }
  }
};
process.on("exit", cleanup);
process.on("SIGINT", () => {
  cleanup();
  process.exit(130);
});

async function waitForHttp(url, ms) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {}
    await sleep(200);
  }
  throw new Error(`Server at ${url} did not answer within ${ms}ms`);
}

async function startServer() {
  const url = process.env.HARNESS_URL;
  if (url) {
    await waitForHttp(url, 5_000);
    return url;
  }
  const viteBin = join(root, "node_modules/.bin/vite");
  const server = spawn(
    viteBin,
    ["--config", "tests/browser/vite.config.ts", "--port", String(port), "--strictPort"],
    { cwd: root, stdio: ["ignore", "pipe", "pipe"], detached: true },
  );
  children.push(server);
  let serverLog = "";
  server.stdout.on("data", (d) => (serverLog += d));
  server.stderr.on("data", (d) => (serverLog += d));
  server.on("exit", (code) => {
    if (!finished) {
      console.error(`Vite exited early (${code}).\n${serverLog}`);
      process.exit(2);
    }
  });
  await waitForHttp(`http://localhost:${port}/`, 30_000);
  return `http://localhost:${port}/`;
}

async function launchChrome() {
  const profile = mkdtempSync(join(tmpdir(), "hyperkinetic-harness-"));
  const chrome = spawn(
    chromePath,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--no-first-run",
      "--no-default-browser-check",
      "--window-size=1280,900",
      "--remote-debugging-port=0",
      `--user-data-dir=${profile}`,
      "about:blank",
    ],
    { stdio: "ignore", detached: true },
  );
  children.push(chrome);
  chrome.on("exit", () => rmSync(profile, { recursive: true, force: true }));
  // Chrome writes "<port>\n<browser ws path>" once the debugger is listening.
  const activePort = join(profile, "DevToolsActivePort");
  const start = Date.now();
  while (!existsSync(activePort)) {
    if (Date.now() - start > 15_000) throw new Error("Chrome did not expose DevToolsActivePort");
    await sleep(100);
  }
  const [wsPort, wsPath] = readFileSync(activePort, "utf8").trim().split("\n");
  return `ws://127.0.0.1:${wsPort}${wsPath}`;
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  const listeners = [];
  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    } else if (msg.method) {
      for (const fn of listeners) fn(msg);
    }
  });
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const msgId = ++id;
      pending.set(msgId, { resolve, reject });
      ws.send(JSON.stringify({ id: msgId, method, params, sessionId }));
    });
  const open = new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", () => reject(new Error("WebSocket error")), { once: true });
  });
  return { open, send, on: (fn) => listeners.push(fn), close: () => ws.close() };
}

let finished = false;
const base = await startServer();
const url = only ? `${base}?only=${encodeURIComponent(only)}` : base;
const cdp = connect(await launchChrome());
await cdp.open;

const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
await cdp.send("Runtime.enable", {}, sessionId);
await cdp.send("Page.enable", {}, sessionId);
const consoleErrors = [];
cdp.on((msg) => {
  if (msg.sessionId !== sessionId) return;
  if (msg.method === "Runtime.exceptionThrown") {
    consoleErrors.push(msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text);
  } else if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
    consoleErrors.push(msg.params.args.map((a) => a.value ?? a.description ?? "").join(" "));
  }
});
await cdp.send("Page.navigate", { url }, sessionId);

const start = Date.now();
let harness = null;
while (Date.now() - start < timeoutMs) {
  const { result } = await cdp.send(
    "Runtime.evaluate",
    { expression: "window.__harness && window.__harness.done ? JSON.stringify(window.__harness) : null", returnByValue: true },
    sessionId,
  );
  if (result.value) {
    harness = JSON.parse(result.value);
    break;
  }
  await sleep(250);
}
finished = true;
cdp.close();
cleanup();

if (!harness) {
  console.error(`Harness did not finish within ${timeoutMs}ms. Console errors:\n${consoleErrors.join("\n")}`);
  process.exit(1);
}

let failed = 0;
for (const r of harness.results) {
  if (r.status === "FAIL") failed++;
  console.log(`${r.status === "PASS" ? "PASS" : "FAIL"}  ${r.name} (${r.ms}ms)`);
  for (const f of r.failures) console.log(`      ✗ ${f}`);
  for (const n of r.notes) console.log(`      · ${n}`);
}
if (harness.errors.length) console.log(`window errors:\n  ${harness.errors.join("\n  ")}`);
// React logs act() warnings and the harness' own expected rejection here; only
// unexpected ones matter, so they are printed, not counted.
if (consoleErrors.length) console.log(`console errors (${consoleErrors.length}):\n  ${consoleErrors.join("\n  ").slice(0, 4000)}`);
console.log(`\n${harness.results.length - failed}/${harness.results.length} checks passed`);
process.exit(failed ? 1 : 0);
