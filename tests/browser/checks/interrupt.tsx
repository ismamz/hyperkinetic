import { Block, Log, mount, outletProps, sleep, type Check } from "../support";

// A navigation mid-animation kills the running timeline, drops that run's
// completion hooks and flags the next run as interrupted.
export const interrupt: Check = {
  name: "interruption kills the run and flags the next one",
  run: async (t) => {
    const log = new Log();
    const fx = mount({
      routes: {
        "/a": <Block log={log} who="a" duration={0.4} />,
        "/b": <Block log={log} who="b" duration={0.4} />,
        "/c": <Block log={log} who="c" duration={0.4} />,
      },
      outlet: outletProps(log),
    });
    try {
      await fx.navigate("/b");
      await sleep(80);
      const first = log.find("outlet", "choreograph")!;
      const firstTl = first.tl!;
      t.ok(firstTl.isActive(), "first timeline is playing before the interruption");
      const bContent = fx.container.querySelector('[data-testid="b"]');

      await fx.navigate("/c");
      // isActive() is true for a parentless animation, so the kill is checked
      // through detachment plus a frozen progress.
      t.equal(firstTl.parent, null, "interrupted timeline was killed (detached from its parent)");
      // time(), not progress(): the trimmed pages revert their contexts, which
      // removes their tweens and shrinks the killed timeline's duration.
      const frozen = firstTl.time();
      t.ok(frozen > 0 && frozen < firstTl.duration(), "interrupted timeline stopped mid-way");
      t.equal(fx.pages().length, 2, "two pages during the second transition");
      t.ok(fx.container.contains(bContent), "the interrupted incoming page became the outgoing one");
      t.equal(fx.container.querySelector('[data-testid="a"]'), null, "the first outgoing page was dropped");

      await fx.settled();
      t.equal(firstTl.time(), frozen, "interrupted timeline did not advance after the kill");
      const choreos = log.all("outlet", "choreograph");
      t.equal(choreos.length, 2, "two runs choreographed");
      t.equal(choreos[1]!.interrupted, true, "second run reports interrupted");
      t.equal(choreos[1]!.from, "/b", "second run current is the interrupted page");
      t.equal(choreos[1]!.to, "/c", "second run next");
      t.deepEqual(
        log.all("outlet", "afterEnter").map((e) => e.to),
        ["/c"],
        "afterEnter never fired for the interrupted run",
      );
      t.deepEqual(log.all("outlet", "after").map((e) => e.to), ["/c"], "after never fired for the interrupted run");
      t.deepEqual(log.events("b").filter((e) => e === "complete"), [], "interrupted incoming recipe never completed");
      t.deepEqual(log.events("b"), ["prepare", "enter", "leave"], "b entered, then left as outgoing");
      t.ok(log.find("c", "complete"), "final incoming recipe completed");

      // After a completed transition the next navigation is not interrupted.
      await fx.navigate("/a");
      await fx.settled();
      t.equal(log.all("outlet", "choreograph")[2]!.interrupted, false, "navigation after completion is not interrupted");

      // Same URL navigation (new location.key) still runs a transition.
      await fx.navigate("/a");
      await fx.settled();
      const same = log.all("outlet", "choreograph")[3];
      t.equal(same?.from, "/a", "same-URL navigation: current");
      t.equal(same?.to, "/a", "same-URL navigation: next");
      t.equal(same?.sameContainer, false, "same-URL navigation mounts a new page");
    } finally {
      fx.unmount();
    }

    // Unmounting the outlet mid-run kills the timeline and fires nothing later.
    const log2 = new Log();
    const fx2 = mount({
      routes: { "/a": <Block log={log2} who="a" duration={0.4} />, "/b": <Block log={log2} who="b" duration={0.4} /> },
      outlet: outletProps(log2),
    });
    await fx2.navigate("/b");
    await sleep(50);
    const tl = log2.find("outlet", "choreograph")!.tl!;
    fx2.unmount();
    await sleep(500);
    t.equal(tl.parent, null, "timeline killed on unmount");
    t.equal(log2.find("outlet", "afterEnter"), undefined, "no completion hooks after unmount");
  },
};
