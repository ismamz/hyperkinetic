import { useRef, useState } from "react";

import { usePersistentTransition } from "@ismamz/react-router-choreo";

import { Block, Log, gsap, mount, outletProps, sleep, type Check } from "../support";

// Selector text inside a recipe resolves within its scope only, preparation
// styles are reverted when the component unmounts, and a scope that never
// attached skips its callbacks.
export const scopes: Check = {
  name: "scopes isolate selectors and revert on unmount",
  run: async (t) => {
    const log = new Log();
    const fx = mount({
      routes: {
        "/a": (
          <Block log={log} who="a" leave={(tl) => tl.set(".mark", { color: "rgb(9, 9, 9)" }, 0)}>
            <span className="mark" data-testid="a-mark">
              a
            </span>
          </Block>
        ),
        "/b": (
          <Block log={log} who="b" enter={(tl) => tl.set(".mark", { color: "rgb(1, 2, 3)" }, 0)}>
            <span className="mark" data-testid="b-mark">
              b
            </span>
          </Block>
        ),
      },
      outlet: outletProps(log),
    });
    try {
      await fx.navigate("/b");
      // Both pages mounted while the timeline plays: the selector tweens ran.
      await sleep(80);
      const aMark = fx.container.querySelector<HTMLElement>('[data-testid="a-mark"]')!;
      const bMark = fx.container.querySelector<HTMLElement>('[data-testid="b-mark"]')!;
      t.ok(aMark && bMark, "both pages mounted during the transition");
      t.equal(aMark.style.color, "rgb(9, 9, 9)", "outgoing leave reached its own .mark");
      t.equal(bMark.style.color, "rgb(1, 2, 3)", "incoming enter reached its own .mark");
      // The incoming enter's `.mark` selector never touched the sibling page.
      t.ok(aMark.style.color !== "rgb(1, 2, 3)", "incoming selector did not reach the outgoing page");
      t.ok(bMark.style.color !== "rgb(9, 9, 9)", "outgoing selector did not reach the incoming page");
      await fx.settled();
    } finally {
      fx.unmount();
    }

    // Cleanup: prepare styles applied through the recipe's gsap.context are
    // reverted when the component unmounts.
    const log2 = new Log();
    let toggle: ((on: boolean) => void) | null = null;
    function Toggle() {
      const [on, setOn] = useState(true);
      toggle = setOn;
      return on ? <Prepared /> : null;
    }
    function Prepared() {
      const scope = useRef<HTMLDivElement>(null);
      usePersistentTransition({
        scope,
        prepare: () => gsap.set(scope.current, { opacity: 0.25, x: 7 }),
        enter: (tl) => tl.to(scope.current, { opacity: 1, duration: 0.1 }, 0),
      });
      return (
        <div ref={scope} data-testid="prepared">
          persistent
        </div>
      );
    }
    const fx2 = mount({
      persistent: <Toggle />,
      routes: { "/a": <p>a</p>, "/b": <p>b</p> },
      outlet: outletProps(log2),
    });
    try {
      const el = () => document.querySelector<HTMLElement>('[data-testid="prepared"]');
      t.equal(el()!.style.opacity, "", "no inline style before any transition");
      await fx2.navigate("/b");
      await sleep(16);
      t.ok(el()!.style.transform.includes("7"), "prepare applied its transform before paint");
      await fx2.settled();
      t.equal(el()!.style.opacity, "1", "enter finished on the persistent element");
      // Keep a handle: after unmount the node is detached but still inspectable.
      const node = el()!;
      toggle!(false);
      await sleep(16);
      t.equal(el(), null, "component unmounted");
      t.equal(node.style.transform, "", "context.revert() cleared the prepare transform");
      t.equal(node.style.opacity, "", "context.revert() cleared the enter opacity");
      // Unregistered: a later navigation calls nothing on it.
      const before = log2.entries.length;
      await fx2.navigate("/a");
      await fx2.settled();
      t.ok(log2.entries.length > before, "second navigation ran");
    } finally {
      fx2.unmount();
    }

    // A scope whose ref never attached skips every callback of that recipe.
    const log3 = new Log();
    function Detached() {
      const scope = useRef<HTMLDivElement>(null);
      usePersistentTransition({
        scope,
        prepare: () => log3.push({ who: "detached", event: "prepare" }),
        leave: () => log3.push({ who: "detached", event: "leave" }),
        enter: () => log3.push({ who: "detached", event: "enter" }),
        complete: () => log3.push({ who: "detached", event: "complete" }),
      });
      return <span>no ref attached</span>;
    }
    const fx3 = mount({
      persistent: <Detached />,
      routes: { "/a": <p>a</p>, "/b": <p>b</p> },
      outlet: outletProps(log3),
    });
    try {
      await fx3.navigate("/b");
      await fx3.settled();
      t.deepEqual(log3.events("detached"), [], "recipe with a detached scope ran no callbacks");
      t.ok(log3.find("outlet", "after"), "the navigation itself completed");
    } finally {
      fx3.unmount();
    }
  },
};
