import { Block, Log, mount, outletProps, waitFor, type Check } from "../support";

// The engine's styling and accessibility API: data attributes per phase and
// `inert` on the outgoing page, all lifted in the same commit as the trim.
export const inert: Check = {
  name: "outgoing page is inert; attributes follow the phases",
  run: async (t) => {
    const log = new Log();
    const fx = mount({
      routes: {
        "/a": (
          <Block log={log} who="a">
            <button data-testid="a-button">a</button>
          </Block>
        ),
        "/b": (
          <Block log={log} who="b">
            <button data-testid="b-button">b</button>
          </Block>
        ),
      },
      outlet: outletProps(log),
    });
    try {
      const wrapper = fx.container.querySelector("[data-wrapper]");
      t.ok(wrapper, "data-wrapper container rendered");
      const rest = fx.pages()[0]!;
      t.ok(!rest.hasAttribute("inert"), "page at rest is not inert");
      t.ok(!rest.hasAttribute("data-page-outgoing") && !rest.hasAttribute("data-page-incoming"), "no phase marks at rest");

      await fx.navigate("/b");
      await waitFor(() => fx.pages().length === 2, "two pages");
      const [outgoing, incoming] = fx.pages() as [HTMLElement, HTMLElement];
      t.ok(outgoing.hasAttribute("inert"), "outgoing page is inert");
      t.ok(outgoing.hasAttribute("data-page-outgoing"), "outgoing mark");
      t.ok(!outgoing.hasAttribute("data-page-incoming"), "outgoing has no incoming mark");
      t.ok(!incoming.hasAttribute("inert"), "incoming page is interactive");
      t.ok(incoming.hasAttribute("data-page-incoming"), "incoming mark");
      t.ok(outgoing.querySelector('[data-testid="a-button"]'), "outgoing keeps the frozen previous tree");
      t.ok(incoming.querySelector('[data-testid="b-button"]'), "incoming renders the new tree");
      // Focus cannot land inside an inert subtree.
      const aButton = outgoing.querySelector<HTMLButtonElement>('[data-testid="a-button"]')!;
      aButton.focus();
      t.ok(document.activeElement !== aButton, "inert outgoing content refuses focus");
      const bButton = incoming.querySelector<HTMLButtonElement>('[data-testid="b-button"]')!;
      bButton.focus();
      t.equal(document.activeElement, bButton, "incoming content accepts focus");
      bButton.blur();

      await fx.settled();
      const settled = fx.pages()[0]!;
      t.equal(settled, incoming, "the incoming page is the one that remains");
      t.ok(!settled.hasAttribute("inert"), "settled page is not inert");
      t.ok(!settled.hasAttribute("data-page-incoming"), "incoming mark lifted with the trim");
      t.ok(!settled.hasAttribute("data-page-outgoing"), "no outgoing mark after the trim");
      t.equal(outgoing.isConnected, false, "outgoing page removed from the DOM");
    } finally {
      fx.unmount();
    }
  },
};
