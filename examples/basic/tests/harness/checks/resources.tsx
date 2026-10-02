import { useEffect, useRef, useState } from "react";

import { usePageTransition, useTransitionResource, type ResourceIssue } from "@ismamz/hyperkinetic";

import { Block, Log, mount, outletProps, sleep, type Check } from "../support";

function defer<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// Resources gate playback only: both pages stay mounted and the outgoing one
// visible while they resolve; timeout and rejection report an issue and play.
export const resources: Check = {
  name: "resources gate playback; timeout and errors report and continue",
  run: async (t) => {
    const log = new Log();
    let gate = defer<void>();
    let mode: "pending" | "timeout" | "reject" | "throw" | "ready" = "pending";
    const issues: ResourceIssue[] = [];
    function Loader() {
      useTransitionResource(() => {
        log.push({ who: "resource", event: `called:${mode}` });
        if (mode === "ready") return "ready";
        if (mode === "throw") throw new Error("sync");
        if (mode === "reject") return Promise.reject(new Error("async"));
        if (mode === "timeout") return new Promise(() => {});
        return gate.promise;
      });
      return null;
    }
    // Mounts a late recipe while the resource wait is in progress.
    function Late({ log }: { log: Log }) {
      const [show, setShow] = useState(false);
      useEffect(() => {
        const id = setTimeout(() => setShow(true), 30);
        return () => clearTimeout(id);
      }, []);
      return show ? <Block log={log} who="late" /> : null;
    }
    const fx = mount({
      persistent: <Loader />,
      routes: {
        "/a": <Block log={log} who="a" />,
        "/b": (
          <>
            <Block log={log} who="b" />
            <Late log={log} />
          </>
        ),
        "/c": <Block log={log} who="c" />,
      },
      outlet: outletProps(log, {
        resources: { timeout: 400, onIssue: (issue) => issues.push(issue) },
      }),
    });
    try {
      // Pending: nothing plays until the gate resolves.
      await fx.navigate("/b");
      await sleep(100);
      t.equal(fx.pages().length, 2, "both pages mounted during the wait");
      t.equal(log.find("outlet", "choreograph"), undefined, "choreograph not called while a resource is pending");
      t.ok(log.find("outlet", "beforeEnter"), "before hooks ran before the wait");
      t.ok(log.find("b", "prepare"), "incoming recipe prepared before the wait");
      t.ok(log.find("late", "prepare"), "recipe registered during the wait was prepared on the spot");
      t.equal(fx.pages()[0]!.style.opacity, "", "outgoing page untouched while waiting");
      gate.resolve();
      await fx.settled();
      t.ok(log.find("outlet", "choreograph"), "choreograph ran after the resource resolved");
      t.ok(log.find("late", "enter"), "late recipe entered with the rest");
      t.deepEqual(issues, [], "no issue for a resolved resource");

      // Timeout: an issue is reported and the transition still plays.
      mode = "timeout";
      await fx.navigate("/c");
      await fx.settled(2000);
      t.deepEqual(issues.map((i) => i.reason), ["timeout"], "timeout reported once");
      t.equal(log.all("outlet", "after").length, 2, "transition completed after the timeout");

      // Rejection: error issue carries the error.
      mode = "reject";
      await fx.navigate("/a");
      await fx.settled();
      t.equal(issues[1]?.reason, "error", "rejection reported as error");
      t.equal((issues[1]?.error as Error)?.message, "async", "rejection error is passed through");

      // Synchronous throw: reported without waiting.
      mode = "throw";
      await fx.navigate("/b");
      await fx.settled();
      t.equal(issues[2]?.reason, "error", "sync throw reported as error");
      t.equal((issues[2]?.error as Error)?.message, "sync", "sync error is passed through");

      // Non-promise return: no wait at all, no issue.
      mode = "ready";
      await fx.navigate("/c");
      await fx.settled();
      t.equal(issues.length, 3, "a ready resource reports nothing");
      t.equal(log.all("resource", "called:ready").length, 1, "resource consulted once per transition");

      // Interrupted during the wait: the stale run must not continue.
      mode = "pending";
      gate = defer<void>();
      const choreos = log.all("outlet", "choreograph").length;
      await fx.navigate("/a");
      await sleep(30);
      mode = "ready";
      await fx.navigate("/b");
      await fx.settled();
      gate.resolve();
      await sleep(50);
      const after = log.all("outlet", "choreograph").slice(choreos);
      t.deepEqual(after.map((e) => e.to), ["/b"], "the run interrupted during its wait never choreographed");
      t.equal(after[0]?.interrupted, true, "navigation during the wait is reported as interrupted");
      t.equal(issues.length, 3, "stale run reported no issue");
    } finally {
      fx.unmount();
    }

    // A resource declared from a page component is only consulted while that
    // page is mounted (it unregisters with the page).
    const log2 = new Log();
    const calls: string[] = [];
    function PageResource({ name }: { name: string }) {
      const ref = useRef<HTMLDivElement>(null);
      useTransitionResource((d) => void calls.push(`${name}:${d.current.pathname}->${d.next.pathname}`));
      usePageTransition({ scope: ref });
      return <div ref={ref}>{name}</div>;
    }
    const fx2 = mount({
      routes: { "/a": <PageResource name="a" />, "/b": <PageResource name="b" />, "/c": <p>c</p> },
      outlet: outletProps(log2),
    });
    try {
      await fx2.navigate("/b");
      await fx2.settled();
      await fx2.navigate("/c");
      await fx2.settled();
      // Both pages are mounted when resources are collected, so both answer on
      // the first navigation; on the second only b remains.
      t.deepEqual(calls, ["a:/a->/b", "b:/a->/b", "b:/b->/c"], "page resources follow their page's mount");
    } finally {
      fx2.unmount();
    }
  },
};
