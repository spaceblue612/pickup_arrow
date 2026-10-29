import { readFile } from "node:fs/promises";

export async function createSmokeDraft(id) {
  const stage = JSON.parse(
    await readFile(
      new URL("../examples/role_chain.json", import.meta.url),
      "utf8",
    ),
  );
  stage.id = id;
  stage.arrows.push({
    id: "ARROW-FIXTURE",
    head_cell: [11, 8],
    cells: [
      [11, 8],
      [10, 8],
    ],
    direction: "RIGHT",
  });
  const cells = [];
  for (let y = 4; y <= 8; y++) for (let x = 3; x <= 9; x++) cells.push([x, y]);
  return {
    stage,
    regions: [{ id: "REGION-FIXTURE", name: "영역 1", cells }],
    targets: {},
    roles: {},
  };
}

// Seed the isolated library directly rather than replaying unrelated UI actions.
export async function prepareSmokeFixture(context) {
  const { store, window, ready, page, until } = context;
  await store.queue;
  const library = await store.load();
  const number =
    Math.max(0, ...library.stages.map((stage) => Number(stage.id.slice(6)))) +
    1;
  const id = `STAGE-${String(number).padStart(3, "0")}`;
  const draft = await createSmokeDraft(id);
  library.stages.push({
    id,
    archived: false,
    candidates: [
      {
        id: `candidate-${id}`,
        name: "검증 후보",
        versions: [
          { id: `version-${id}`, at: "2026-01-01T00:00:00.000Z", draft },
        ],
      },
    ],
  });
  await store.save(library, library.revision);
  await store.recover(null);
  const loaded = new Promise((resolve) =>
    window.webContents.once("did-finish-load", resolve),
  );
  window.webContents.reload();
  await loaded;
  await ready();
  await page(
    `(()=>{const button=[...document.querySelectorAll('.stage-row')].find(button=>button.textContent.includes(${JSON.stringify(id)}));button.click();})()`,
  );
  await until(
    `document.querySelector('h1').textContent===${JSON.stringify(id)}`,
  );
  window.show();
  window.focus();
  return { id, draft };
}
