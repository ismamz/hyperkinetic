import { useEnterReady } from "@ismamz/hyperkinetic";

import { Block, Log, Persistent, ReadyProbe, mount, outletProps, waitFor, type Check } from "../support";

// First load: same choreography, no outgoing page, no page exits — but the
// persistent recipes' leave still runs (documented nuance).
export const initial: Check = {
  name: "first load runs once and can be opted out",
  run: async (t) => {
    const log = new Log();
    const fx = mount({
      persistent: <Persistent log={log} who="persistent" />,
      routes: {
        "/a": (
          <>
            <Block log={log} who="a" />
            <ReadyProbe log={log} who="a-probe" useEnterReady={useEnterReady} />
          </>
        ),
        "/b": <Block log={log} who="b" />,
      },
      outlet: outletProps(log, { initial: undefined }),
    });
    try {
      const page = fx.pages()[0]!;
      // The attribute is rendered by React and removed on the DOM once prepared.
      t.ok(page.hasAttribute("data-page-initial"), "first page is marked initial before preparation");
      await waitFor(() => !!log.find("outlet", "after"), "initial run to finish");

      t.deepEqual(
        log.entries.map((e) => `${e.who}.${e.event}`).filter((s) => !s.startsWith("a-probe")),
        [
          "outlet.before",
          "outlet.beforeEnter",
          "persistent.prepare",
          "a.prepare",
          "persistent.leave",
          "outlet.choreograph",
          "persistent.enter",
          "a.enter",
          "persistent.complete",
          "a.complete",
          "outlet.afterEnter",
          "outlet.after",
        ],
        "initial lifecycle: persistent.leave runs, page leave does not",
      );
      const choreo = log.find("outlet", "choreograph")!;
      t.equal(choreo.initial, true, "initial flag");
      t.equal(choreo.sameContainer, true, "current and next are the same container on first load");
      t.equal(choreo.from, "/a", "current.pathname");
      t.equal(choreo.to, "/a", "next.pathname");
      t.equal(log.find("a", "leave"), undefined, "no page exit on first load");
      t.ok(!fx.pages()[0]!.hasAttribute("data-page-initial"), "initial mark removed");
      t.ok(!fx.pages()[0]!.hasAttribute("data-page-incoming"), "no incoming mark at rest");
      t.deepEqual(log.events("a-probe"), ["ready:false", "ready:true"], "useEnterReady gates the first load");

      // A normal navigation afterwards is not initial.
      await fx.navigate("/b");
      await fx.settled();
      const second = log.all("outlet", "choreograph")[1]!;
      t.equal(second.initial, false, "navigation after first load is not initial");
      t.equal(log.all("outlet", "after").length, 2, "after ran for both runs");
    } finally {
      fx.unmount();
    }

    // Opt-out: nothing runs and the page is ready immediately.
    const log2 = new Log();
    const fx2 = mount({
      persistent: <Persistent log={log2} who="persistent" />,
      routes: {
        "/a": (
          <>
            <Block log={log2} who="a" />
            <ReadyProbe log={log2} who="a-probe" useEnterReady={useEnterReady} />
          </>
        ),
      },
      outlet: outletProps(log2, { initial: false }),
    });
    try {
      await new Promise((r) => setTimeout(r, 60));
      t.deepEqual(log2.events("outlet"), [], "initial:false runs no global hooks");
      t.deepEqual(log2.events("persistent"), [], "initial:false runs no persistent recipe");
      t.deepEqual(log2.events("a"), [], "initial:false runs no page recipe");
      t.deepEqual(log2.events("a-probe"), ["ready:true"], "page is ready from the first render");
      t.ok(!fx2.pages()[0]!.hasAttribute("data-page-initial"), "no initial mark when opted out");
    } finally {
      fx2.unmount();
    }
  },
};
