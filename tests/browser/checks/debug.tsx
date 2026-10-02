import { useEnterReady } from "hyperkinetic";

import { Block, Log, ReadyProbe, mount, outletProps, sleep, waitFor, type Check } from "../support";

// Development-only flags. retainPages keeps both pages after completion
// without flagging the next navigation as interrupted; devTools mounts one
// GSDevTools panel per run and removes it with the run.
// Runs last: registering GSDevTools has global GSAP side effects.
export const debugRetain: Check = {
  name: "debug.retainPages keeps pages and the next navigation is not interrupted",
  run: async (t) => {
    const log = new Log();
    const fx = mount({
      routes: {
        "/a": <Block log={log} who="a" />,
        "/b": (
          <>
            <Block log={log} who="b" />
            <ReadyProbe log={log} who="b-probe" useEnterReady={useEnterReady} />
          </>
        ),
        "/c": <Block log={log} who="c" />,
      },
      outlet: outletProps(log, { debug: { retainPages: true } }),
    });
    try {
      await fx.navigate("/b");
      await waitFor(() => !!log.find("outlet", "afterEnter"), "afterEnter");
      await sleep(100);
      t.equal(fx.pages().length, 2, "both pages retained after completion");
      const [outgoing, incoming] = fx.pages() as [HTMLElement, HTMLElement];
      t.ok(outgoing.hasAttribute("inert"), "retained outgoing stays inert");
      t.ok(outgoing.hasAttribute("data-page-outgoing"), "retained outgoing keeps its mark");
      t.ok(
        !incoming.hasAttribute("data-page-incoming"),
        "retained incoming lost its incoming mark",
      );
      t.equal(
        log.find("outlet", "after"),
        undefined,
        "after does not run while pages are retained",
      );
      t.ok(log.find("b", "complete"), "complete ran");
      t.deepEqual(
        log.events("b-probe"),
        ["ready:false", "ready:true"],
        "retained incoming page is entered/ready",
      );

      await fx.navigate("/c");
      await waitFor(() => log.all("outlet", "afterEnter").length === 2, "second afterEnter");
      await sleep(50);
      const second = log.all("outlet", "choreograph")[1]!;
      t.equal(
        second.interrupted,
        false,
        "navigation after a retained completion is not interrupted",
      );
      t.equal(second.from, "/b", "retained incoming became the outgoing page");
      t.equal(fx.pages().length, 2, "still two pages: the oldest retained page was dropped");
      t.equal(
        fx.container.querySelector('[data-testid="a"]'),
        null,
        "first page dropped on the next navigation",
      );
      t.ok(fx.container.querySelector('[data-testid="b"]'), "previous incoming kept as outgoing");
      t.ok(fx.container.querySelector('[data-testid="c"]'), "new incoming mounted");
    } finally {
      fx.unmount();
    }
  },
};

export const debugDevTools: Check = {
  name: "debug.devTools mounts one panel per run and removes it with the run",
  run: async (t) => {
    const log = new Log();
    const panels = () => document.querySelectorAll(".gs-dev-tools").length;
    t.equal(panels(), 0, "no panel before the check");
    const fx = mount({
      routes: {
        "/a": <Block log={log} who="a" />,
        "/b": <Block log={log} who="b" />,
        "/c": <Block log={log} who="c" />,
      },
      outlet: outletProps(log, { debug: { devTools: true } }),
    });
    try {
      await fx.navigate("/b");
      await fx.settled();
      await sleep(50);
      t.equal(panels(), 1, "one panel after the first run (it survives completion)");
      const first = log.find("outlet", "choreograph")!.tl!;
      t.equal(first.progress(), 1, "timeline completed with the panel attached");
      await fx.navigate("/c");
      await fx.settled();
      await sleep(50);
      t.equal(panels(), 1, "previous panel killed, new one created for the second run");
    } finally {
      fx.unmount();
    }
    await sleep(16);
    t.equal(panels(), 0, "panel removed on unmount");
    t.note(
      "GSDevTools registration leaves global GSAP side effects (globalTimeline.autoRemoveChildren=false)",
    );
  },
};
