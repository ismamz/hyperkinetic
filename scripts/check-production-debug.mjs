#!/usr/bin/env node
// The debug flags are development-only: a production build of examples/basic
// must not contain GSDevTools nor the panel id. Run after
// `FILTER=basic pnpm build:example`.
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const assets = join(root, "examples/basic/build/client/assets");
if (!existsSync(assets)) {
  console.error(`Missing ${assets}. Run: FILTER=basic pnpm build:example`);
  process.exit(2);
}
const forbidden = ["GSDevTools", "gs-dev-tools", "page-transition"];
const outletMarker = "data-page-outgoing";
let hits = [];
let outletFound = false;
for (const file of readdirSync(assets).filter((f) => f.endsWith(".js"))) {
  const source = readFileSync(join(assets, file), "utf8");
  if (source.includes(outletMarker)) outletFound = true;
  for (const needle of forbidden) if (source.includes(needle)) hits.push(`${file}: ${needle}`);
}
if (!outletFound) {
  console.error(
    `FAIL  production bundle does not contain the engine outlet (${outletMarker}); wrong build?`,
  );
  process.exit(1);
}
if (hits.length) {
  console.error(`FAIL  debug code present in production assets:\n  ${hits.join("\n  ")}`);
  process.exit(1);
}
console.log("PASS  production client assets contain the engine and no GSDevTools/debug panel code");
