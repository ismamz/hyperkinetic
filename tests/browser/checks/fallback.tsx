import { Block, Log, mount, outletProps, type Check } from "../support";

// Real DOM version of the selection algorithm: a scope that declares a
// direction owns its subtree for that direction only; omission inherits.
export const fallback: Check = {
  name: "fallback selected independently per direction",
  run: async (t) => {
    const log = new Log();
    const targets: Record<string, string[]> = {};
    const page = (prefix: string) => (
      <>
        <section data-testid={`${prefix}-hero`}>
          {/* Owns leave only: its enter inherits the fallback. */}
          <Block log={log} who={`${prefix}-title`} enter="omit" />
          <p data-testid={`${prefix}-lead`}>lead</p>
        </section>
        {/* Opts out of enter with `false`; leave inherits. */}
        <Block log={log} who={`${prefix}-list`} enter={false} leave="omit" />
        <footer data-testid={`${prefix}-footer`}>footer</footer>
        {/* No DOM scope: contributes to the timeline but claims nothing. */}
        <Block log={log} who={`${prefix}-free`} scopeless />
      </>
    );
    const fx = mount({
      routes: { "/a": page("a"), "/b": page("b") },
      outlet: outletProps(log, {
        fallback: {
          leave: (tl, d) => {
            targets.leave = d.targets.map(testid);
            tl.to(d.targets, { opacity: 0, duration: 0.1 }, 0);
          },
          enter: (tl, d) => {
            targets.enter = d.targets.map(testid);
            tl.fromTo(d.targets, { opacity: 0 }, { opacity: 1, duration: 0.1 }, 0);
          },
        },
      }),
    });
    try {
      await fx.navigate("/b");
      await fx.settled();
      // a-title owns leave → hero is a mixed ancestor; a-list inherits leave.
      t.deepEqual(targets.leave, ["a-lead", "a-list", "a-footer", "a-free"], "leave targets");
      // b-list owns enter (false) → excluded; b-title inherits enter → hero whole.
      t.deepEqual(targets.enter, ["b-hero", "b-footer", "b-free"], "enter targets");
      t.equal(log.find("a-title", "leave")?.event, "leave", "a-title leaves on its own");
      t.equal(log.find("a-list", "leave"), undefined, "omitted leave runs no callback");
      t.equal(log.find("b-list", "enter"), undefined, "enter:false runs no enter callback");
      t.equal(log.find("b-title", "enter"), undefined, "omitted enter runs no callback");
      t.equal(log.find("b-free", "enter")?.event, "enter", "scopeless recipe still contributes");
    } finally {
      fx.unmount();
    }

    // `false` at the config level disables that direction entirely.
    const log2 = new Log();
    const calls: string[] = [];
    const fx2 = mount({
      routes: { "/a": <p data-testid="a">a</p>, "/b": <p data-testid="b">b</p> },
      outlet: outletProps(log2, {
        fallback: {
          leave: false,
          prepare: () => calls.push("prepare"),
          enter: (tl, d) => {
            calls.push(`enter:${d.targets.map(testid).join(",")}`);
            tl.fromTo(d.targets, { opacity: 0 }, { opacity: 1, duration: 0.1 }, 0);
          },
        },
      }),
    });
    try {
      await fx2.navigate("/b");
      await fx2.settled();
      // Nothing is scoped, so the page container itself is the single target.
      t.deepEqual(calls, ["prepare", "enter:div"], "leave:false disables leave; enter claims the page container");
    } finally {
      fx2.unmount();
    }
  },
};

function testid(el: Element) {
  return el.getAttribute("data-testid") ?? el.tagName.toLowerCase();
}
