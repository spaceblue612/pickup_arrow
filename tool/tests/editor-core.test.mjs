import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { CoreHost } from "../src/core-host.mjs";
import {
  resizeBend,
  extendEndpoint,
  translateCells,
} from "../src/arrow-geometry.mjs";
const stage = JSON.parse(
  await readFile(
    new URL("../examples/role_chain.json", import.meta.url),
    "utf8",
  ),
);
const settings = {
  godot: process.env.ARROW_GODOT || "godot",
  project: fileURLToPath(new URL("../../", import.meta.url)),
  timeoutMs: 15000,
};
test("duplicated arrow placement is validated together with the original by Godot", async () => {
  const host = new CoreHost();
  const source = structuredClone(stage);
  source.arrows = [
    {
      id: "ORIGINAL",
      head_cell: [6, 2],
      cells: [
        [6, 2],
        [6, 3],
        [6, 4],
        [7, 4],
        [8, 4],
        [9, 4],
      ],
      direction: "UP",
    },
  ];
  for (const [offset, blocked, valid] of [
    [[-4, 2], [], true],
    [[0, 0], [], false],
    [[1, 0], [], false],
    [[-4, 2], [[3, 6]], false],
    [[-5, 7], [], false],
  ]) {
    const candidate = structuredClone(source),
      cells = translateCells(source.arrows[0].cells, offset);
    candidate.blocked_cells = blocked;
    candidate.arrows.push({
      id: "COPY",
      head_cell: cells[0],
      cells,
      direction: "UP",
    });
    const response = await host.run(
      {
        operation: "validate_stage",
        stage: candidate,
        stage_contract: "authoring_v1",
      },
      settings,
    );
    assert.equal(response.validation.valid, valid);
    assert.deepEqual(candidate.arrows[0], source.arrows[0]);
  }
});
test("endpoint shortening commits through Godot and derives direction from the remaining body", async () => {
  const host = new CoreHost();
  const source = structuredClone(stage);
  source.arrows = [
    {
      id: "A",
      head_cell: [6, 2],
      cells: [
        [6, 2],
        [6, 3],
        [6, 4],
        [7, 4],
        [8, 4],
        [9, 4],
      ],
      direction: "UP",
    },
  ];
  for (const part of ["head", "tail"]) {
    const stroke =
      part === "head"
        ? source.arrows[0].cells
        : [...source.arrows[0].cells].reverse();
    const cells = extendEndpoint(source.arrows[0].cells, stroke, part);
    const response = await host.run(
      {
        operation: "reshape_arrow",
        stage: source,
        stage_contract: "authoring_v1",
        arrow_id: "A",
        cells,
      },
      settings,
    );
    assert.equal(response.edit.accepted, true);
    assert.equal(response.edit.stage.arrows[0].cells.length, 2);
    assert.equal(
      response.edit.stage.arrows[0].direction,
      part === "head" ? "LEFT" : "UP",
    );
  }
  assert.equal(source.arrows[0].cells.length, 6);
});
test("tail crossing is accepted by Godot while forbidden cells and bounds still reject atomically", async () => {
  const host = new CoreHost(),
    source = structuredClone(stage);
  source.arrows = [
    {
      id: "A",
      head_cell: [6, 2],
      cells: [
        [6, 2],
        [6, 3],
        [6, 4],
        [7, 4],
        [8, 4],
        [9, 4],
      ],
      direction: "UP",
    },
  ];
  for (const [delta, blocked, accepted] of [
    [[4, 0], [], true],
    [[4, 0], [[10, 3]], false],
    [[7, 0], [], false],
  ]) {
    const input = structuredClone(source);
    input.blocked_cells = blocked;
    const cells = resizeBend(input.arrows[0].cells, 2, delta);
    const response = await host.run(
      {
        operation: "reshape_arrow",
        stage: input,
        stage_contract: "authoring_v1",
        arrow_id: "A",
        cells,
      },
      settings,
    );
    assert.equal(response.edit.accepted, accepted);
    if (accepted) {
      assert.deepEqual(response.edit.stage.arrows[0].cells, [
        [10, 2],
        [10, 3],
        [10, 4],
        [9, 4],
      ]);
      assert.equal(response.edit.stage.arrows[0].direction, "UP");
    } else assert.deepEqual(response.edit.stage, input);
  }
});
test("crossing a head during spacing reverses direction through Godot but still rejects collisions", async () => {
  const host = new CoreHost();
  const source = structuredClone(stage);
  source.arrows = [
    {
      id: "A",
      head_cell: [6, 2],
      cells: [
        [6, 2],
        [6, 3],
        [6, 4],
        [7, 4],
        [8, 4],
        [9, 4],
      ],
      direction: "UP",
    },
  ];
  const cells = resizeBend(source.arrows[0].cells, 2, [0, -3]);
  const moved = await host.run(
    {
      operation: "reshape_arrow",
      stage: source,
      stage_contract: "authoring_v1",
      arrow_id: "A",
      cells,
    },
    settings,
  );
  assert.equal(moved.edit.accepted, true);
  assert.equal(moved.edit.stage.arrows[0].direction, "DOWN");
  assert.deepEqual(moved.edit.stage.arrows[0].cells, cells);
  const blocked = structuredClone(source);
  blocked.blocked_cells = [[7, 1]];
  const rejected = await host.run(
    {
      operation: "reshape_arrow",
      stage: blocked,
      stage_contract: "authoring_v1",
      arrow_id: "A",
      cells,
    },
    settings,
  );
  assert.equal(rejected.edit.accepted, false);
  assert.deepEqual(rejected.edit.stage, blocked);
  assert.equal(source.arrows[0].direction, "UP");
});
test("reshape derives head direction through Godot and rejects malformed cells before launch", async () => {
  const host = new CoreHost();
  const original = structuredClone(stage);
  const moved = await host.run(
    {
      operation: "reshape_arrow",
      stage,
      stage_contract: "authoring_v1",
      arrow_id: "C",
      cells: [
        [8, 5],
        [9, 5],
        [9, 6],
      ],
    },
    settings,
  );
  assert.equal(moved.edit.accepted, true);
  assert.equal(
    moved.edit.stage.arrows.find((a) => a.id === "C").direction,
    "LEFT",
  );
  const blocked = await host.run(
    {
      operation: "reshape_arrow",
      stage,
      stage_contract: "authoring_v1",
      arrow_id: "C",
      cells: [
        [6, 5],
        [6, 6],
      ],
    },
    settings,
  );
  assert.equal(blocked.edit.accepted, false);
  assert.deepEqual(blocked.edit.stage, original);
  assert.deepEqual(stage, original);
  await assert.rejects(
    host.run(
      {
        operation: "reshape_arrow",
        stage,
        arrow_id: "C",
        cells: [
          [1.5, 2],
          [2, 2],
        ],
      },
      settings,
    ),
  );
  assert.equal(host.busy, false);
});
test("authoring contract rejects head-only arrows while keeping legacy runtime compatibility", async () => {
  const host = new CoreHost();
  const short = structuredClone(stage);
  short.arrows[0].cells = [short.arrows[0].head_cell];
  const invalid = await host.run(
    {
      operation: "analyze_stage",
      stage: short,
      stage_contract: "authoring_v1",
    },
    settings,
  );
  assert.equal(invalid.validation.valid, false);
  assert.equal(invalid.analysis, undefined);
  const valid = await host.run(
    { operation: "analyze_stage", stage, stage_contract: "authoring_v1" },
    settings,
  );
  assert.deepEqual(valid.analysis.available_arrow_ids, ["Z"]);
});
test("whole-arrow translation goes through Godot and invalid offsets never start it", async () => {
  const host = new CoreHost();
  const moved = await host.run(
    {
      operation: "translate_arrow",
      stage,
      stage_contract: "authoring_v1",
      arrow_id: "C",
      offset: [1, 0],
    },
    settings,
  );
  assert.equal(moved.edit.accepted, true);
  assert.deepEqual(
    moved.edit.stage.arrows.find((a) => a.id === "C").head_cell,
    [9, 5],
  );
  const blocked = await host.run(
    {
      operation: "translate_arrow",
      stage,
      stage_contract: "authoring_v1",
      arrow_id: "C",
      offset: [-2, 0],
    },
    settings,
  );
  assert.equal(blocked.edit.accepted, false);
  assert.deepEqual(blocked.edit.stage, stage);
  await assert.rejects(
    host.run(
      { operation: "translate_arrow", stage, arrow_id: "C", offset: [1.5, 0] },
      settings,
    ),
    /이동량/,
  );
  assert.equal(host.busy, false);
  await assert.rejects(
    host.run(
      { operation: "translate_arrow", stage, arrow_id: "", offset: [1, 0] },
      settings,
    ),
    /화살표 ID/,
  );
});
