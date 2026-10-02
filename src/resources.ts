import type { HookData, ResourceConfig, ResourceFn, ResourceIssue } from "./types.js";

// Registration is module level, like the persistent recipes: a resource is
// declared by something already mounted, since a component that is still
// suspended cannot release the wait it is causing.
const resources = new Set<ResourceFn>();

export function registerResource(fn: ResourceFn) {
  resources.add(fn);
  return () => {
    resources.delete(fn);
  };
}

export function collectResources(data: HookData, config: ResourceConfig | undefined) {
  return waitForResources(resources, data, config);
}

// Returns null when nothing has to be waited for, so a transition without
// registered resources keeps playing in the same tick as before.
export function waitForResources(
  registry: Iterable<ResourceFn>,
  data: HookData,
  config: ResourceConfig | undefined,
) {
  const pending: Promise<unknown>[] = [];
  let failure: ResourceIssue | undefined;
  for (const resource of registry) {
    try {
      const value = resource(data);
      if (value instanceof Promise) pending.push(value);
    } catch (error) {
      failure = { reason: "error", error };
    }
  }
  if (!pending.length) return failure ?? null;
  return wait(pending, failure, config?.timeout ?? 5000);
}

async function wait(
  pending: Promise<unknown>[],
  failure: ResourceIssue | undefined,
  timeout: number,
): Promise<ResourceIssue | null> {
  let timer = 0;
  const expiry = new Promise<ResourceIssue>((resolve) => {
    timer = window.setTimeout(() => resolve({ reason: "timeout" }), timeout);
  });
  try {
    const issue = await Promise.race([
      Promise.all(pending).then(
        () => failure ?? null,
        (error: unknown) => ({ reason: "error", error }) as ResourceIssue,
      ),
      expiry,
    ]);
    return issue;
  } finally {
    clearTimeout(timer);
  }
}
