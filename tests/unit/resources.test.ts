import assert from "node:assert/strict";
import { test } from "node:test";

import { registerResource, waitForResources, collectResources } from "../../dist/resources.js";
import type { HookData, ResourceFn } from "../../dist/types.js";

// The timeout timer is scheduled through `window.setTimeout`; Node has no
// window, so only that one function is provided.
(globalThis as { window?: unknown }).window = {
  setTimeout: globalThis.setTimeout.bind(globalThis),
};

const data = { initial: false, interrupted: false } as HookData;
const defer = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

test("nothing pending returns null synchronously so the transition plays in the same tick", () => {
  assert.equal(waitForResources([() => "ready", () => undefined, () => 42], data, undefined), null);
  assert.equal(waitForResources([], data, undefined), null);
});

test("a synchronous throw is reported as an error issue without waiting", () => {
  const boom = new Error("boom");
  const issue = waitForResources(
    [
      () => {
        throw boom;
      },
    ],
    data,
    undefined,
  );
  assert.deepEqual(issue, { reason: "error", error: boom });
});

test("pending promises gate the result until every one of them resolves", async () => {
  const a = defer<void>();
  const b = defer<void>();
  let settled = false;
  const wait = waitForResources([() => a.promise, () => b.promise], data, undefined);
  assert.ok(wait instanceof Promise);
  void wait.then(() => (settled = true));
  a.resolve();
  await Promise.resolve();
  assert.equal(settled, false);
  b.resolve();
  assert.equal(await wait, null);
});

test("a rejected resource reports an error issue; the wait still ends", async () => {
  const a = defer<void>();
  const wait = waitForResources([() => a.promise], data, undefined) as Promise<unknown>;
  a.reject("nope");
  assert.deepEqual(await wait, { reason: "error", error: "nope" });
});

test("the timeout is a safety net: an issue is reported and the promise is no longer awaited", async () => {
  const never = new Promise(() => {});
  const wait = waitForResources([() => never], data, { timeout: 20 }) as Promise<unknown>;
  assert.deepEqual(await wait, { reason: "timeout" });
});

test("a synchronous throw beside a pending promise is still reported once it resolves", async () => {
  const a = defer<void>();
  const boom = new Error("sync");
  const wait = waitForResources(
    [
      () => {
        throw boom;
      },
      () => a.promise,
    ],
    data,
    undefined,
  ) as Promise<unknown>;
  a.resolve();
  assert.deepEqual(await wait, { reason: "error", error: boom });
});

test("the module registry is consulted on every collect and honours unregister", () => {
  const calls: string[] = [];
  const first: ResourceFn = () => void calls.push("first");
  const second: ResourceFn = () => void calls.push("second");
  const offFirst = registerResource(first);
  const offSecond = registerResource(second);
  collectResources(data, undefined);
  assert.deepEqual(calls, ["first", "second"]);
  offFirst();
  collectResources(data, undefined);
  assert.deepEqual(calls, ["first", "second", "second"]);
  offSecond();
  collectResources(data, undefined);
  assert.deepEqual(calls, ["first", "second", "second"]);
});
