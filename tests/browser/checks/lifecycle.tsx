import { Block, Log, Persistent, mount, outletProps, type Check } from "../support";

// One navigation, every kind of contributor: the order of the lifecycle and the
// identity of the timeline they all write to.
export const lifecycle: Check = {
  name: "shared timeline and lifecycle order",
  run: async (t) => {
    const log = new Log();
    const fallbackTargets: Record<string, string[]> = {};
    const fx = mount({
      persistent: <Persistent log={log} who="persistent" />,
      routes: {
        "/a": (
          <>
            <Block log={log} who="a-title" />
            <p data-testid="a-plain">plain</p>
          </>
        ),
        "/b": (
          <>
            <Block log={log} who="b-title" enterAt="intro" />
            <Block log={log} who="b-side" />
            <p data-testid="b-plain">plain</p>
          </>
        ),
      },
      outlet: outletProps(log, {
        fallback: {
          enterAt: "intro",
          prepare: (d) => {
            log.push({ who: "fallback", event: "prepare" });
            fallbackTargets.prepare = d.targets.map(testid);
          },
          leave: (tl, d) => {
            log.push({ who: "fallback", event: "leave", tl, position: d.position });
            fallbackTargets.leave = d.targets.map(testid);
            tl.to(d.targets, { opacity: 0, duration: 0.1 }, 0);
          },
          enter: (tl, d) => {
            log.push({ who: "fallback", event: "enter", tl, position: d.position });
            fallbackTargets.enter = d.targets.map(testid);
            tl.fromTo(d.targets, { opacity: 0 }, { opacity: 1, duration: 0.1 }, d.position);
          },
        },
      }),
    });
    try {
      t.equal(fx.pages().length, 1, "one page at rest");
      t.deepEqual(log.events(), [], "initial:false runs no hooks");

      await fx.navigate("/b");
      await fx.settled();

      const order = log.entries.map((e) => `${e.who}.${e.event}`);
      t.deepEqual(
        order,
        [
          "outlet.before",
          "outlet.beforeEnter",
          "persistent.prepare",
          "b-title.prepare",
          "b-side.prepare",
          "fallback.prepare",
          "fallback.leave",
          "persistent.leave",
          "a-title.leave",
          "outlet.choreograph",
          "fallback.enter",
          "persistent.enter",
          "b-title.enter",
          "b-side.enter",
          "persistent.complete",
          "b-title.complete",
          "b-side.complete",
          "outlet.afterEnter",
          "outlet.after",
        ],
        "lifecycle order",
      );

      const timelines = log.timelines();
      t.equal(timelines.size, 1, "every contributor received the same master timeline");
      const tl = [...timelines][0]!;
      t.ok(tl.getChildren(false).length >= 6, "all contributions landed on the master timeline");
      t.equal(tl.progress(), 1, "master timeline finished");

      t.equal(log.find("outlet", "afterEnter")?.pages, 2, "afterEnter runs with both pages mounted");
      t.equal(log.find("outlet", "after")?.pages, 1, "after runs once the outgoing page is gone");
      for (const e of log.entries) {
        if (e.who === "fallback") continue;
        t.equal(e.from, "/a", `${e.who}.${e.event} current.pathname`);
        t.equal(e.to, "/b", `${e.who}.${e.event} next.pathname`);
        t.equal(e.initial, false, `${e.who}.${e.event} initial`);
        t.equal(e.interrupted, false, `${e.who}.${e.event} interrupted`);
      }
      const choreo = log.find("outlet", "choreograph")!;
      t.equal(choreo.sameContainer, false, "current and next containers differ on a navigation");
      t.equal(
        choreo.reduced,
        window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        "reduced mirrors prefers-reduced-motion",
      );

      t.equal(log.find("a-title", "enter"), undefined, "outgoing recipe never enters");
      t.equal(log.find("b-title", "leave"), undefined, "incoming recipe never leaves");
      t.equal(log.find("a-title", "complete"), undefined, "outgoing recipe never completes");

      t.close(log.find("b-title", "enter")!.position as number, tl.labels.intro, "enterAt label resolves to its time");
      t.equal(log.find("b-side", "enter")!.position, 0, "no enterAt means position 0");
      t.close(log.find("fallback", "enter")!.position as number, tl.labels.intro, "fallback enterAt resolves too");

      // Scoped blocks own both directions; only the unclaimed paragraph falls back.
      t.deepEqual(fallbackTargets.leave, ["a-plain"], "fallback leave targets");
      t.deepEqual(fallbackTargets.enter, ["b-plain"], "fallback enter targets");
      t.deepEqual(fallbackTargets.prepare, ["b-plain"], "fallback prepare receives the enter targets");

      t.equal(fx.pages().length, 1, "one page after the trim");
      t.ok(fx.container.querySelector('[data-testid="b-title"]'), "incoming content remains");
      t.equal(fx.container.querySelector('[data-testid="a-title"]'), null, "outgoing content was removed");
    } finally {
      fx.unmount();
    }
  },
};

function testid(el: Element) {
  return el.getAttribute("data-testid") ?? el.tagName.toLowerCase();
}
