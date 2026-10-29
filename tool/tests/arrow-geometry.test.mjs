import test from "node:test";
import assert from "node:assert/strict";
import {
  appendStroke,
  bendInfo,
  directionFromCells,
  extendEndpoint,
  resizeBend,
  rotateGroup,
  translateCells,
} from "../src/arrow-geometry.mjs";
const cells = [
  [6, 2],
  [6, 3],
  [6, 4],
  [7, 4],
  [8, 4],
  [9, 4],
];
test("copy placement translates every cell without changing shape, direction, or the source", () => {
  const before = structuredClone(cells);
  const copied = translateCells(cells, [-4, 2]);
  assert.deepEqual(copied, [
    [2, 4],
    [2, 5],
    [2, 6],
    [3, 6],
    [4, 6],
    [5, 6],
  ]);
  assert.equal(directionFromCells(copied), directionFromCells(cells));
  copied[0][0] = 99;
  assert.deepEqual(cells, before);
  assert.deepEqual(translateCells(cells, [0, 0]), cells);
});
test("quarter turns move only the chosen group around the fixed pivot", () => {
  const original = structuredClone(cells);
  assert.deepEqual(rotateGroup(cells, 1, "tail", true), [
    [6, 2],
    [6, 3],
    [5, 3],
    [5, 4],
    [5, 5],
    [5, 6],
  ]);
  assert.deepEqual(rotateGroup(cells, 1, "head", true), [
    [7, 3],
    [6, 3],
    [6, 4],
    [7, 4],
    [8, 4],
    [9, 4],
  ]);
  assert.deepEqual(rotateGroup(cells, 0, "tail", true), [
    [6, 2],
    [5, 2],
    [4, 2],
    [4, 3],
    [4, 4],
    [4, 5],
  ]);
  assert.deepEqual(cells, original);
});
test("bend spacing adjusts either adjoining segment while preserving group shapes", () => {
  assert.deepEqual(bendInfo(cells, 2), {
    anchor: 0,
    axis: [0, 1],
    length: 2,
    tailAnchor: 5,
    nextAxis: [1, 0],
    nextLength: 3,
  });
  assert.equal(bendInfo(cells, 1), null);
  assert.deepEqual(resizeBend(cells, 2, [0, 1]), [
    [6, 2],
    [6, 3],
    [6, 4],
    [6, 5],
    [7, 5],
    [8, 5],
    [9, 5],
  ]);
  assert.deepEqual(resizeBend(cells, 2, [0, -2]), [
    [6, 2],
    [6, 3],
    [7, 3],
    [8, 3],
    [9, 3],
  ]);
  assert.deepEqual(resizeBend(cells, 2, [1, 0]), [
    [7, 2],
    [7, 3],
    [7, 4],
    [8, 4],
    [9, 4],
  ]);
  assert.deepEqual(resizeBend(cells, 2, [1, 1]), [
    [7, 2],
    [7, 3],
    [7, 4],
    [7, 5],
    [8, 5],
    [9, 5],
  ]);
  assert.deepEqual(resizeBend(cells, 2, [3, -2]), [
    [8, 2],
    [8, 3],
    [9, 3],
  ]);
});
test("two-axis spacing works for all bend orientations without mutating the original", () => {
  const original = structuredClone(cells);
  const expected = [
    [7, 2],
    [7, 3],
    [7, 4],
    [7, 5],
    [8, 5],
    [9, 5],
  ];
  for (const mirror of [1, -1])
    for (let turns = 0; turns < 4; turns++) {
      const transform = ([x, y]) => {
        x *= mirror;
        for (let n = 0; n < turns; n++) [x, y] = [-y, x];
        return [x + 30, y + 30];
      };
      const zero = transform([0, 0]),
        delta = transform([1, 1]).map((v, i) => v - zero[i]);
      const source = cells.map(transform);
      assert.deepEqual(resizeBend(source, 2, delta), expected.map(transform));
      const shrunk = resizeBend(
        source,
        2,
        transform([3, -2]).map((v, i) => v - zero[i]),
      );
      assert.equal(shrunk.length, 3);
    }
  assert.deepEqual(cells, original);
});
test("head-connected spacing crosses the head and derives the reversed direction in every orientation", () => {
  const expected = [
    [6, 2],
    [6, 1],
    [7, 1],
    [8, 1],
    [9, 1],
  ];
  for (const mirror of [1, -1])
    for (let turns = 0; turns < 4; turns++) {
      const transform = ([x, y]) => {
        x *= mirror;
        for (let n = 0; n < turns; n++) [x, y] = [-y, x];
        return [x + 30, y + 30];
      };
      const zero = transform([0, 0]);
      const delta = transform([0, -3]).map((v, i) => v - zero[i]);
      const source = cells.map(transform);
      const result = resizeBend(source, 2, delta);
      assert.deepEqual(result, expected.map(transform));
      assert.notEqual(directionFromCells(result), directionFromCells(source));
      assert.deepEqual(
        resizeBend(
          result,
          1,
          delta.map((v) => -v),
        ),
        source,
        "crossing back restores the original shape and direction",
      );
      assert.equal(new Set(result.map((c) => c.join(","))).size, result.length);
      assert.deepEqual(source, cells.map(transform));
    }
  const diagonal = resizeBend(cells, 2, [1, -3]);
  assert.deepEqual(diagonal, [
    [7, 2],
    [7, 1],
    [8, 1],
    [9, 1],
  ]);
  assert.equal(directionFromCells(diagonal), "DOWN");
});
test("tail-connected spacing crosses and crosses back symmetrically in all orientations", () => {
  const expected = [
    [10, 2],
    [10, 3],
    [10, 4],
    [9, 4],
  ];
  for (const mirror of [1, -1])
    for (let turns = 0; turns < 4; turns++) {
      const transform = ([x, y]) => {
        x *= mirror;
        for (let n = 0; n < turns; n++) [x, y] = [-y, x];
        return [x + 30, y + 30];
      };
      const zero = transform([0, 0]),
        delta = transform([4, 0]).map((v, i) => v - zero[i]);
      const source = cells.map(transform),
        result = resizeBend(source, 2, delta);
      assert.deepEqual(result, expected.map(transform));
      assert.deepEqual(result.at(-1), source.at(-1));
      assert.equal(directionFromCells(result), directionFromCells(source));
      assert.deepEqual(
        resizeBend(
          result,
          2,
          delta.map((v) => -v),
        ),
        source,
      );
      assert.deepEqual(source, cells.map(transform));
    }
  assert.deepEqual(
    resizeBend(cells, 2, [3, 0]),
    [
      [8, 2],
      [8, 3],
      [8, 4],
      [9, 4],
    ],
    "exact tail contact preserves one edge",
  );
  assert.deepEqual(
    resizeBend(cells, 2, [4, -3]),
    [
      [10, 2],
      [10, 1],
      [9, 1],
    ],
    "both endpoint segments can cross together",
  );
});
test("spacing translates the groups beyond adjacent bends rigidly and keeps every connection cardinal", () => {
  const source = [[4, 2], [5, 2], [6, 2], ...cells.slice(1), [9, 5], [9, 6]];
  const expected = [
    [5, 2],
    [6, 2],
    [7, 2],
    [7, 3],
    [7, 4],
    [7, 5],
    [8, 5],
    [9, 5],
    [9, 6],
    [9, 7],
  ];
  assert.deepEqual(resizeBend(source, 4, [1, 1]), expected);
  for (const delta of [
    [-2, 2],
    [2, -5],
    [0, 0],
  ]) {
    const result = resizeBend(source, 4, delta);
    assert.equal(new Set(result.map((c) => c.join(","))).size, result.length);
    result
      .slice(1)
      .forEach((c, i) =>
        assert.equal(
          Math.abs(c[0] - result[i][0]) + Math.abs(c[1] - result[i][1]),
          1,
        ),
      );
  }
  assert.deepEqual(resizeBend(source, 0, [1, 1]), source);
});
test("extension supports bends at either endpoint and keeps head-first ordering", () => {
  assert.deepEqual(
    extendEndpoint(
      cells,
      [
        [6, 2],
        [6, 1],
        [5, 1],
      ],
      "head",
    ),
    [[5, 1], [6, 1], ...cells],
  );
  assert.deepEqual(
    extendEndpoint(
      cells,
      [
        [9, 4],
        [10, 4],
        [10, 5],
      ],
      "tail",
    ),
    [...cells, [10, 4], [10, 5]],
  );
  assert.equal(
    directionFromCells(
      extendEndpoint(
        cells,
        [
          [6, 2],
          [6, 1],
          [5, 1],
        ],
        "head",
      ),
    ),
    "LEFT",
  );
});
test("endpoints trim inward through bends and stop at two cells", () => {
  const original = structuredClone(cells);
  assert.deepEqual(
    extendEndpoint(
      cells,
      [
        [6, 2],
        [6, 3],
        [6, 4],
        [7, 4],
      ],
      "head",
    ),
    cells.slice(3),
  );
  assert.deepEqual(
    extendEndpoint(
      cells,
      [
        [9, 4],
        [8, 4],
        [7, 4],
        [6, 4],
        [6, 3],
      ],
      "tail",
    ),
    cells.slice(0, 2),
  );
  assert.deepEqual(extendEndpoint(cells, cells, "head"), cells.slice(-2));
  assert.deepEqual(
    extendEndpoint(cells, [...cells].reverse(), "tail"),
    cells.slice(0, 2),
  );
  assert.deepEqual(
    extendEndpoint(cells.slice(0, 2), cells.slice(0, 2), "head"),
    cells.slice(0, 2),
  );
  assert.deepEqual(cells, original);
});
test("retracing a trimmed endpoint restores cells and can branch into a new extension", () => {
  let stroke = appendStroke([[9, 4]], [7, 4]);
  assert.deepEqual(extendEndpoint(cells, stroke, "tail"), cells.slice(0, 4));
  const branch = appendStroke(stroke, [7, 5]);
  assert.deepEqual(extendEndpoint(cells, branch, "tail"), [
    ...cells.slice(0, 4),
    [7, 5],
  ]);
  stroke = appendStroke(stroke, [9, 4]);
  assert.deepEqual(extendEndpoint(cells, stroke, "tail"), cells);
  const outward = appendStroke([[6, 2]], [6, 1]);
  const back = appendStroke(outward, [6, 2]);
  assert.deepEqual(
    extendEndpoint(cells, appendStroke(back, [6, 4]), "head"),
    cells.slice(2),
  );
});
test("head trimming derives direction from the remaining body in every orientation", () => {
  for (const mirror of [1, -1])
    for (let turns = 0; turns < 4; turns++) {
      const transform = ([x, y]) => {
        x *= mirror;
        for (let n = 0; n < turns; n++) [x, y] = [-y, x];
        return [x + 30, y + 30];
      };
      const source = cells.map(transform);
      const result = extendEndpoint(source, source.slice(0, 4), "head");
      assert.deepEqual(result, source.slice(3));
      assert.notEqual(directionFromCells(result), directionFromCells(source));
      result
        .slice(1)
        .forEach((c, i) =>
          assert.equal(
            Math.abs(c[0] - result[i][0]) + Math.abs(c[1] - result[i][1]),
            1,
          ),
        );
    }
});
test("pointer interpolation is cardinal, allows backtracking, and never closes a duplicate loop", () => {
  assert.deepEqual(appendStroke([[1, 1]], [3, 2]), [
    [1, 1],
    [2, 1],
    [3, 1],
    [3, 2],
  ]);
  assert.deepEqual(
    appendStroke(
      [
        [1, 1],
        [2, 1],
        [3, 1],
      ],
      [1, 1],
    ),
    [[1, 1]],
  );
  assert.deepEqual(
    appendStroke(
      [
        [1, 1],
        [2, 1],
        [2, 2],
        [1, 2],
      ],
      [1, 1],
    ),
    [
      [1, 1],
      [2, 1],
      [2, 2],
      [1, 2],
    ],
  );
});
