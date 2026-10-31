import assert from "node:assert/strict";
import { createSmokeContext } from "./smoke-context.mjs";
import { prepareSmokeFixture } from "./smoke-fixture.mjs";
import { selectSmokeSuites } from "./smoke-selection.mjs";

export async function runSmoke(
  window,
  store,
  directory,
  selection = "startup",
) {
  const suites = selectSmokeSuites(selection);
  const context = createSmokeContext(window, store, directory);
  await context.ready();
  const started = performance.now();
  const checks = {};
  for (const name of suites) {
    console.log(`EDITOR_SUITE_START:${name}`);
    const before = performance.now();
    let result;
    switch (name) {
      case "startup":
        assert.equal(await context.page(`typeof window.require`), "undefined");
        assert.equal(await context.page(`typeof window.process`), "undefined");
        assert.ok(await context.page(`!!document.querySelector('main')`));
        result = { rendererReady: true, nodeIsolated: true };
        break;
      case "preferences": {
        const { runPreferences } = await import("./preferences-smoke.mjs");
        result = await runPreferences(context);
        break;
      }
      case "workflow": {
        const { runWorkflow } = await import("./workflow-smoke.mjs");
        window.show();
        window.focus();
        result = await runWorkflow(context);
        break;
      }
      case "layout": {
        const fixture = await prepareSmokeFixture(context);
        const { runLayout } = await import("./layout-smoke.mjs");
        result = await runLayout(context, fixture);
        break;
      }
      case "placement": {
        await prepareSmokeFixture(context);
        const { runPlacementControls } =
          await import("./placement-controls-smoke.mjs");
        result = await runPlacementControls(context);
        break;
      }
      case "rulers": {
        const { runRulers } = await import("./ruler-smoke.mjs");
        result = await runRulers(context);
        break;
      }
      case "bends": {
        const { runLocalBend } = await import("./local-bend-smoke.mjs");
        result = await runLocalBend(context);
        break;
      }
      case "editing": {
        await prepareSmokeFixture(context);
        const { runBoardInteractions } =
          await import("./board-interactions.mjs");
        result = await runBoardInteractions(context);
        break;
      }
    }
    checks[name] = {
      ...result,
      elapsedMs: Math.round(performance.now() - before),
    };
    console.log(
      `EDITOR_SUITE_DONE:${JSON.stringify({ name, elapsedMs: checks[name].elapsedMs })}`,
    );
  }
  return {
    directory,
    suites,
    checks,
    elapsedMs: Math.round(performance.now() - started),
  };
}
