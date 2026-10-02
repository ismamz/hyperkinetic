import assert from "node:assert/strict";
import { test } from "node:test";

import { persistentRecipes, registerPersistent } from "../../dist/persistent.js";
import type { PageTransition } from "../../dist/types.js";

test("persistent recipes are snapshotted in registration order and removed on unregister", () => {
  const a: PageTransition = { group: "a" };
  const b: PageTransition = { group: "b" };
  const offA = registerPersistent(a);
  const offB = registerPersistent(b);
  assert.deepEqual(persistentRecipes(), [a, b]);
  // The snapshot is a copy: mutating it does not touch the registry.
  persistentRecipes().pop();
  assert.deepEqual(persistentRecipes(), [a, b]);
  offA();
  assert.deepEqual(persistentRecipes(), [b]);
  offB();
  assert.deepEqual(persistentRecipes(), []);
  // Unregistering twice is harmless.
  offB();
  assert.deepEqual(persistentRecipes(), []);
});

test("registering the same recipe twice keeps a single entry", () => {
  const a: PageTransition = {};
  const off1 = registerPersistent(a);
  const off2 = registerPersistent(a);
  assert.deepEqual(persistentRecipes(), [a]);
  off1();
  assert.deepEqual(persistentRecipes(), []);
  off2();
});
