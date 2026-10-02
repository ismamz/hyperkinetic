import gsap from "gsap";
import { useRef } from "react";

import { usePageTransition, type AnimatedOutletProps } from "@ismamz/hyperkinetic";

import { Log, ReadyProbe, mount, outletProps, waitFor, type Check } from "../support";
import { useEnterReady } from "@ismamz/hyperkinetic";

// The README's recommended recipe/choreograph/fallback/resources snippets,
// copied verbatim. Keep both in sync: this check is what lets the README call
// them verified.

export function Title({ children }: { children: React.ReactNode }) {
  const scope = useRef<HTMLHeadingElement>(null);

  usePageTransition({
    scope,
    group: "titles",
    enterAt: "titles-in",
    leave: (tl, { position, reduced }) => {
      tl.to(scope.current, { y: -12, autoAlpha: 0, duration: reduced ? 0 : 0.3 }, position);
    },
    enter: (tl, { position, reduced }) => {
      tl.fromTo(
        scope.current,
        { y: 12, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: reduced ? 0 : 0.45 },
        position,
      );
    },
  });

  return <h1 ref={scope}>{children}</h1>;
}

const issues: string[] = [];
const measured: Record<string, number> = {};
const targets: Record<string, string[]> = {};

const readmeProps = {
  choreograph: ({ tl, initial, reduced, leaveEnd, ready }) => {
    const contentStart = initial || reduced ? 0 : 0.15;
    tl.addLabel("content-in", contentStart);
    // Incoming titles wait for the real end of the outgoing ones.
    tl.addLabel("titles-in", Math.max(contentStart, leaveEnd("titles")));
    tl.call(ready, [], contentStart);
    measured.contentIn = tl.labels["content-in"];
    measured.titlesIn = tl.labels["titles-in"];
    measured.exitsEnd = tl.duration();
  },
  fallback: {
    enterAt: "content-in",
    prepare: ({ targets }) => {
      gsap.set(targets, { autoAlpha: 0 });
    },
    leave: (tl, { targets, position, reduced }) => {
      tl.to(targets, { autoAlpha: 0, duration: reduced ? 0 : 0.35 }, position);
    },
    enter: (tl, { targets, position, reduced }) => {
      tl.to(targets, { autoAlpha: 1, duration: reduced ? 0 : 0.7, clearProps: "opacity,visibility" }, position);
    },
  },
  resources: {
    timeout: 5000, // default
    onIssue: ({ reason, error }, { next }) => {
      console.warn(`Transition to ${next.pathname}: ${reason}`, error);
      issues.push(reason);
    },
  },
} satisfies Partial<AnimatedOutletProps>;

export const readme: Check = {
  name: "readme recommended snippets",
  run: async (t) => {
    const log = new Log();
    const fx = mount({
      routes: {
        "/a": (
          <>
            <Title>A</Title>
            <p data-testid="a-body">a</p>
          </>
        ),
        "/b": (
          <>
            <Title>B</Title>
            <p data-testid="b-body">b</p>
            <ReadyProbe log={log} who="b-probe" useEnterReady={useEnterReady} />
          </>
        ),
      },
      outlet: outletProps(log, {
        ...readmeProps,
        fallback: {
          ...readmeProps.fallback,
          leave: (tl, d) => {
            targets.leave = d.targets.map(testid);
            readmeProps.fallback.leave(tl, d);
          },
          enter: (tl, d) => {
            targets.enter = d.targets.map(testid);
            readmeProps.fallback.enter(tl, d);
          },
        },
      }),
    });
    try {
      await fx.navigate("/b");
      await waitFor(() => log.events("b-probe").includes("ready:true"), "ready() at content-in");
      t.equal(log.find("outlet", "afterEnter"), undefined, "latch released before the run finished");
      await fx.settled();

      t.close(measured.contentIn, 0.15, "content-in label");
      t.close(measured.titlesIn, 0.3, "titles-in waits for the real end of the outgoing title (0.3)");
      t.close(measured.exitsEnd, 0.35, "tl.duration() inside choreograph is the end of all exits (fallback 0.35)");
      // The title owns both directions, so the fallback animates its siblings only.
      t.deepEqual(targets.leave, ["a-body"], "fallback leave targets");
      t.deepEqual(targets.enter, ["b-body", "b-probe-ready"], "fallback enter targets");
      const body = fx.container.querySelector<HTMLElement>('[data-testid="b-body"]')!;
      t.equal(body.style.opacity, "", "clearProps removed the fallback opacity");
      t.equal(body.style.visibility, "", "clearProps removed the fallback visibility");
      const title = fx.container.querySelector<HTMLElement>("h1")!;
      t.equal(getComputedStyle(title).opacity, "1", "incoming title ended visible");
      t.deepEqual(issues, [], "no resource issue reported");
      t.equal(fx.pages().length, 1, "trimmed to one page");
    } finally {
      fx.unmount();
    }
  },
};

function testid(el: Element) {
  return el.getAttribute("data-testid") ?? el.tagName.toLowerCase();
}
