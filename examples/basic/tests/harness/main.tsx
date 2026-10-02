import { debugDevTools, debugRetain } from "./checks/debug";
import { fallback } from "./checks/fallback";
import { groups } from "./checks/groups";
import { inert } from "./checks/inert";
import { initial } from "./checks/initial";
import { interrupt } from "./checks/interrupt";
import { lifecycle } from "./checks/lifecycle";
import { persistent } from "./checks/persistent";
import { readme } from "./checks/readme";
import { resources } from "./checks/resources";
import { scopes } from "./checks/scopes";
import { Expect, type Check, type CheckResult } from "./support";

// Debug checks last: GSDevTools registration mutates GSAP globals.
const checks: Check[] = [
  lifecycle,
  fallback,
  scopes,
  groups,
  initial,
  resources,
  interrupt,
  inert,
  persistent,
  readme,
  debugRetain,
  debugDevTools,
];

declare global {
  interface Window {
    __harness?: { done: boolean; results: CheckResult[]; errors: string[] };
  }
}

const harness: NonNullable<Window["__harness"]> = { done: false, results: [], errors: [] };
window.__harness = harness;
window.addEventListener("error", (e) => harness.errors.push(String(e.message)));

const only = new URLSearchParams(location.search).get("only");
const out = document.getElementById("out")!;
const render = () => {
  out.textContent = JSON.stringify(harness, null, 2);
};

for (const check of checks) {
  if (only && !check.name.includes(only)) continue;
  const t = new Expect();
  const start = performance.now();
  try {
    await check.run(t);
  } catch (error) {
    t.failures.push(`threw: ${error instanceof Error ? error.message : String(error)}`);
  }
  harness.results.push({
    name: check.name,
    status: t.failures.length ? "FAIL" : "PASS",
    failures: t.failures,
    notes: t.notes,
    ms: Math.round(performance.now() - start),
  });
  render();
}
harness.done = true;
document.title = harness.results.every((r) => r.status === "PASS") ? "PASS" : "FAIL";
render();
