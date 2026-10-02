import { useState } from "react";

import { Block, Log, Persistent, mount, outletProps, type Check } from "../support";

// Persistent recipes run in both directions on every transition, their group
// is measurable, and unmounting unregisters them.
export const persistent: Check = {
  name: "persistent recipes run every transition and unregister",
  run: async (t) => {
    const log = new Log();
    const ends: number[] = [];
    let hide: (() => void) | null = null;
    function Toggle() {
      const [on, setOn] = useState(true);
      hide = () => setOn(false);
      return on ? <Persistent log={log} who="scene" group="scene" duration={0.3} /> : null;
    }
    const fx = mount({
      persistent: (
        <>
          <Toggle />
          <Persistent log={log} who="header" duration={0.1} />
        </>
      ),
      routes: { "/a": <Block log={log} who="a" />, "/b": <Block log={log} who="b" />, "/c": <Block log={log} who="c" /> },
      outlet: outletProps(log, {
        choreograph: (d) => {
          ends.push(d.leaveEnd("scene"));
          d.tl.addLabel("intro", 0);
          d.tl.fromTo(d.next.container, { opacity: 0 }, { opacity: 1, duration: 0.1 }, 0);
        },
      }),
    });
    try {
      await fx.navigate("/b");
      await fx.settled();
      await fx.navigate("/c");
      await fx.settled();
      const perRun = ["prepare", "leave", "enter", "complete"];
      t.deepEqual(log.events("scene"), [...perRun, ...perRun], "scene recipe ran fully on both transitions");
      t.deepEqual(log.events("header"), [...perRun, ...perRun], "header recipe ran fully on both transitions");
      t.close(ends[0]!, 0.3, "persistent group end measured on run 1");
      t.close(ends[1]!, 0.3, "persistent group end measured on run 2");
      for (const e of log.entries.filter((e) => e.who === "scene" || e.who === "header")) {
        if (e.event === "leave" || e.event === "enter") t.ok(e.tl, `${e.who}.${e.event} received the timeline`);
      }
      t.equal(log.timelines().size, 2, "one master timeline per navigation");

      hide!();
      await fx.navigate("/a");
      await fx.settled();
      t.equal(log.events("scene").length, 8, "unmounted persistent recipe was not called again");
      t.equal(log.events("header").length, 12, "remaining persistent recipe still ran");
      t.equal(ends[2], 0, "unregistered group measures 0");
    } finally {
      fx.unmount();
    }
  },
};
