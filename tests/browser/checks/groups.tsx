import { useEnterReady } from "hyperkinetic";

import { Block, Log, ReadyProbe, mount, outletProps, sleep, waitFor, type Check } from "../support";

// Group ends are measured from real contributions; `ready()` releases the
// incoming latch early and the latch survives the outgoing phase; an unknown
// label is a hard failure of the run.
export const groups: Check = {
  name: "groups, labels and the enter-ready latch",
  run: async (t) => {
    const log = new Log();
    const measured: Record<string, number> = {};
    const fx = mount({
      routes: {
        "/a": (
          <>
            <Block log={log} who="a-1" group="titles" duration={0.2} />
            <Block log={log} who="a-2" group="titles" duration={0.3} position={0.1} />
            <Block log={log} who="a-3" group="other" duration={0.05} />
            <Block log={log} who="a-4" duration={1} />
          </>
        ),
        "/b": (
          <>
            <Block log={log} who="b-1" enterAt="after-titles" duration={0.1} />
            <ReadyProbe log={log} who="b-probe" useEnterReady={useEnterReady} />
          </>
        ),
        "/c": <p>c</p>,
      },
      outlet: outletProps(log, {
        choreograph: (d) => {
          measured.titles = d.leaveEnd("titles");
          measured.other = d.leaveEnd("other");
          measured.unknown = d.leaveEnd("unknown");
          d.tl.addLabel("after-titles", measured.titles);
          d.tl.to(d.current.container, { opacity: 0, duration: 0.2 }, 0);
          d.tl.fromTo(d.next.container, { opacity: 0 }, { opacity: 1, duration: 0.2 }, measured.titles);
          // Release the incoming latch while the outgoing page is still leaving.
          d.tl.call(d.ready, [], 0.05);
          // Measured here: after the trim the outgoing page's context is
          // reverted and its tweens leave the master timeline.
          log.push({ who: "outlet", event: "choreograph", tl: d.tl, duration: d.tl.duration() });
        },
      }),
    });
    try {
      await fx.navigate("/b");
      t.deepEqual(log.events("b-probe"), ["ready:false"], "incoming page starts not ready");
      await waitFor(() => log.events("b-probe").includes("ready:true"), "ready() to release the latch");
      t.equal(log.find("b-probe", "ready:true")?.pages, 2, "latch released while both pages are mounted");
      t.equal(log.find("outlet", "afterEnter"), undefined, "latch released before the run finished");
      await fx.settled();

      t.close(measured.titles, 0.4, "leaveEnd(titles) is the real end of the group (0.1 + 0.3)");
      t.close(measured.other, 0.05, "leaveEnd(other)");
      t.equal(measured.unknown, 0, "unknown group measures 0");
      // Ungrouped a-4 (1s) is not measured, so the timeline outlasts the group.
      const choreo = log.find("outlet", "choreograph")!;
      t.close(choreo.duration as number, 1, "ungrouped leave still defines the timeline length");
      t.ok(choreo.tl!.duration() < 1, "after the trim the outgoing page's tweens were reverted off the timeline");
      t.close(log.find("b-1", "enter")!.position as number, 0.4, "enterAt resolves to the published label");

      // Latch stays true while the page becomes outgoing.
      await fx.navigate("/c");
      await fx.settled();
      t.deepEqual(log.events("b-probe"), ["ready:false", "ready:true"], "latch never flipped back during outgoing");
    } finally {
      fx.unmount();
    }

    // Unknown label: the run rejects, but the outlet must recover to one page.
    const log2 = new Log();
    const rejections: string[] = [];
    const onRejection = (e: PromiseRejectionEvent) => {
      rejections.push(String(e.reason?.message ?? e.reason));
      e.preventDefault();
    };
    window.addEventListener("unhandledrejection", onRejection);
    const fx2 = mount({
      routes: { "/a": <p>a</p>, "/b": <Block log={log2} who="b" enterAt="missing" /> },
      outlet: outletProps(log2),
    });
    try {
      await fx2.navigate("/b");
      await sleep(100);
      t.deepEqual(rejections, ["Unknown page transition label: missing"], "unknown enterAt label rejects the run");
      t.equal(log2.find("outlet", "afterEnter"), undefined, "the failed run never completes");
      await fx2.settled(500);
      t.equal(fx2.pages()[0]?.textContent, "b", "incoming page survives a failed run");
      t.ok(!fx2.pages()[0]?.hasAttribute("inert"), "surviving page is interactive");
      t.equal(fx2.pages()[0]?.style.opacity, "", "failed timeline restores inline styles");
      await fx2.navigate("/a");
      await fx2.settled();
      t.equal(fx2.pages()[0]?.textContent, "a", "a later navigation still completes");
    } finally {
      window.removeEventListener("unhandledrejection", onRejection);
      fx2.unmount();
    }
  },
};
