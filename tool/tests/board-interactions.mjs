import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";

export async function runBoardInteractions({
  window,
  store,
  directory,
  page,
  until,
  click,
  analyze,
}) {
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  window.show();
  window.focus();
  await delay(150);
  await page(
    `(()=>{window.__boardInputLog=[];for(const type of ['pointerdown','pointermove','pointerup'])window.addEventListener(type,e=>{const svg=document.querySelector('svg.editable-board');if(!svg)return;const point=new DOMPoint(e.clientX,e.clientY).matrixTransform(svg.getScreenCTM().inverse());window.__boardInputLog.push({type,x:e.clientX,y:e.clientY,cell:[Math.floor(point.x/40)+1,Math.floor(point.y/40)+1],button:e.button,buttons:e.buttons});window.__boardInputLog=window.__boardInputLog.slice(-30);},true)})()`,
  );
  async function key(keyCode, type = "keyDown") {
    window.webContents.sendInputEvent({ type, keyCode });
    await delay(30);
  }
  async function escape() {
    await key("Escape");
    await key("Escape", "keyUp");
    await delay(80);
  }
  async function screen(c) {
    return page(
      `(()=>{const m=document.querySelector('svg.editable-board').getScreenCTM(),p=new DOMPoint((${c[0]}-.5)*40,(${c[1]}-.5)*40).matrixTransform(m);return{x:Math.round(p.x),y:Math.round(p.y)}})()`,
    );
  }
  async function pointer(type, pos, button = "left", modifiers = []) {
    window.webContents.sendInputEvent({
      type,
      ...pos,
      button,
      clickCount: 1,
      modifiers,
    });
    await page(
      `new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`,
    );
    await delay(40);
  }
  async function drag(
    cells,
    {
      shift = false,
      releaseShift = false,
      pressShift = false,
      cancel = false,
      wait = true,
      capture = null,
      abort = null,
      alt = false,
      releaseAlt = false,
      pressAlt = false,
    } = {},
  ) {
    const positions = [];
    for (const c of cells) positions.push(await screen(c));
    if (shift) await key("Shift");
    if (alt) await key("Alt");
    await pointer("mouseDown", positions[0], "left", [
      ...(shift ? ["shift"] : []),
      ...(alt ? ["alt"] : []),
    ]);
    if (releaseShift) await key("Shift", "keyUp");
    if (pressShift) await key("Shift");
    if (releaseAlt) await key("Alt", "keyUp");
    if (pressAlt) await key("Alt");
    for (const pos of positions.slice(1))
      await pointer("mouseMove", pos, "left", [
        "leftButtonDown",
        ...((shift && !releaseShift) || pressShift ? ["shift"] : []),
        ...((alt && !releaseAlt) || pressAlt ? ["alt"] : []),
      ]);
    if (capture) {
      await delay(100);
      await window.webContents
        .capturePage()
        .then((image) =>
          writeFile(path.join(directory, capture), image.toPNG()),
        );
    }
    if (cancel) await escape();
    if (abort === "blur") await page(`window.dispatchEvent(new Event('blur'))`);
    if (abort === "pointercancel")
      await page(
        `document.querySelector('svg.editable-board').dispatchEvent(new PointerEvent('pointercancel',{pointerId:1,bubbles:true}))`,
      );
    await pointer("mouseUp", positions.at(-1));
    if (shift || pressShift) await key("Shift", "keyUp");
    if (alt || pressAlt) await key("Alt", "keyUp");
    if (wait) {
      await until(
        `document.querySelector('main').dataset.coreBusy==='false'&&document.querySelector('.interactive-board').dataset.pending==='false'`,
      );
      await delay(80);
    }
  }
  async function menu(c) {
    const pos = await screen(c);
    await pointer("mouseDown", pos, "right");
    await pointer("mouseUp", pos, "right");
    await until(`!!document.querySelector('[role="menu"]')`);
  }
  async function shape() {
    return page(
      `(()=>{const g=document.querySelector('svg [data-arrow-id]');if(!g)return[];return g.querySelector('polyline').getAttribute('points').split(' ').map(v=>v.split(',').map(n=>Number(n)/40+.5))})()`,
    );
  }
  async function undo() {
    await click("↶ 실행 취소");
    await delay(80);
  }
  const originalStage = (await store.load()).stages.at(-1).id;
  await page(`document.querySelector('[aria-label="스테이지 추가"]').click()`);
  await until(`document.querySelectorAll('svg [data-arrow-id]').length===0`);
  const original = [
    [6, 2],
    [6, 3],
    [6, 4],
    [7, 4],
    [8, 4],
    [9, 4],
  ];
  await drag([
    [6, 2],
    [6, 4],
    [9, 4],
  ]);
  assert.deepEqual(
    await shape(),
    original,
    "empty ground drag creates a cardinal arrow without a drawing tool",
  );
  await click("저장 ↗");
  await until(`document.querySelector('main').dataset.dirty==='false'`);
  await store.queue;
  const fixtureId = (await store.load()).stages.at(-1).id;

  for (const [cell, kind, text] of [
    [[6, 2], "head", "머리"],
    [[9, 4], "tail", "꼬리"],
    [[6, 3], "body", "직선 몸통"],
    [[6, 4], "corner", "양쪽 간격 조절"],
  ]) {
    await pointer("mouseMove", await screen(cell));
    await until(
      `document.querySelector('.interactive-board').dataset.hoverKind===${JSON.stringify(kind)}`,
    );
    assert.ok(
      (
        await page(
          `document.querySelector('[data-testid="hover-hint"]').textContent`,
        )
      ).includes(text),
    );
    assert.equal(
      await page(`!!document.querySelector('[data-testid="hover-target"]')`),
      true,
    );
  }
  await window.webContents
    .capturePage()
    .then((image) =>
      writeFile(path.join(directory, "corner-hover.png"), image.toPNG()),
    );
  await pointer("mouseMove", await screen([2, 7]));
  assert.equal(
    await page(`!!document.querySelector('[data-testid="hover-hint"]')`),
    false,
    "empty ground clears hover hints",
  );
  assert.equal(
    await page(`document.querySelector('main').dataset.dirty`),
    "false",
    "hovering never edits the stage",
  );

  // A right click only opens the target menu; Esc does not commit an edit.
  await menu([6, 3]);
  assert.deepEqual(await shape(), original);
  assert.equal(
    await page(`!!document.querySelector('[data-testid="edit-pivot"]')`),
    true,
  );
  await escape();
  assert.equal(await page(`!!document.querySelector('[role="menu"]')`), false);
  assert.equal(
    await page(`document.querySelector('main').dataset.dirty`),
    "false",
  );

  const undoState = () =>
    page(
      `JSON.stringify([...document.querySelectorAll('button')].filter(b=>['↶ 실행 취소','↷ 다시 실행'].includes(b.textContent.trim())).map(b=>b.disabled))`,
    );
  const historyBeforeRoundTrip = await undoState();
  const roundTrips = [
    {
      name: "Alt duplicate",
      alt: true,
      path: [
        [6, 2],
        [2, 4],
        [6, 2],
      ],
    },
    {
      name: "menu duplicate",
      menuCell: [6, 3],
      label: "복제 후 이동",
      path: [
        [6, 3],
        [2, 5],
        [6, 3],
      ],
    },
    {
      name: "direct move",
      path: [
        [6, 3],
        [7, 3],
        [6, 3],
      ],
    },
    {
      name: "direct gap",
      path: [
        [6, 4],
        [7, 5],
        [6, 4],
      ],
    },
    {
      name: "direct head",
      path: [
        [6, 2],
        [6, 1],
        [6, 2],
      ],
    },
    {
      name: "direct tail",
      path: [
        [9, 4],
        [10, 4],
        [9, 4],
      ],
    },
    {
      name: "menu move",
      menuCell: [9, 4],
      label: "전체 이동",
      path: [
        [9, 4],
        [10, 5],
        [9, 4],
      ],
    },
    {
      name: "whole rotation",
      menuCell: [6, 2],
      label: "전체 90° 회전 · 머리 고정",
      path: [
        [9, 4],
        [9, 5],
        [9, 4],
      ],
    },
    {
      name: "head rotation",
      menuCell: [6, 3],
      label: "머리 쪽 꺾임 추가",
      path: [
        [6, 2],
        [7, 2],
        [6, 2],
      ],
    },
    {
      name: "tail rotation",
      menuCell: [6, 3],
      label: "꼬리 쪽 꺾임 추가",
      path: [
        [9, 4],
        [9, 5],
        [9, 4],
      ],
    },
    {
      name: "menu gap",
      menuCell: [6, 4],
      label: "꺾임 간격 조절",
      path: [
        [6, 4],
        [7, 5],
        [6, 4],
      ],
    },
    {
      name: "menu head",
      menuCell: [6, 2],
      label: "머리 연장·축소",
      path: [
        [6, 2],
        [6, 1],
        [6, 2],
      ],
    },
    {
      name: "menu tail",
      menuCell: [9, 4],
      label: "꼬리 연장·축소",
      path: [
        [9, 4],
        [10, 4],
        [9, 4],
      ],
    },
  ];
  async function assertFinishedUnchanged(name) {
    assert.equal(
      await page(`document.querySelectorAll('svg [data-arrow-id]').length`),
      1,
      name + " creates no duplicate",
    );
    assert.deepEqual(
      await shape(),
      original,
      name + " preserves the original shape",
    );
    assert.equal(
      await page(
        "document.querySelector('.interactive-board').dataset.operation",
      ),
      "none",
      name + " exits its tool",
    );
    assert.equal(
      await page(
        "document.querySelector('.interactive-board').dataset.editing",
      ),
      "false",
      name + " finishes its gesture",
    );
    assert.equal(
      await page("document.querySelector('main').dataset.mode"),
      "auto",
    );
    assert.equal(
      await page("document.querySelector('main').dataset.dirty"),
      "false",
      name + " creates no dirty state",
    );
    assert.equal(
      await undoState(),
      historyBeforeRoundTrip,
      name + " preserves undo/redo",
    );
    assert.equal(
      await page(
        "document.querySelectorAll('svg.editable-board polyline[stroke=\"#ec48bd\"]').length",
      ),
      0,
      name + " clears preview",
    );
  }
  for (const testCase of roundTrips) {
    if (testCase.label) {
      await menu(testCase.menuCell);
      await click(testCase.label);
    }
    await drag(testCase.path, { alt: Boolean(testCase.alt) });
    await assertFinishedUnchanged(testCase.name);
  }
  // A chosen one-shot tool also ends on a click with no drag, or an outside drop.
  for (const testCase of roundTrips.filter((t) => t.label)) {
    await menu(testCase.menuCell);
    await click(testCase.label);
    await drag([testCase.path[0], testCase.path[0]]);
    await assertFinishedUnchanged(testCase.name + " click");
  }
  await menu([6, 3]);
  await click("전체 이동");
  await drag([
    [6, 3],
    [0, 3],
  ]);
  await assertFinishedUnchanged("outside drop");
  for (const abort of ["blur", "pointercancel"]) {
    await menu([6, 4]);
    await click("꺾임 간격 조절");
    await drag(
      [
        [6, 4],
        [7, 5],
      ],
      { abort },
    );
    await assertFinishedUnchanged(abort);
  }
  // Panning is not an edit completion: keep an explicitly chosen tool armed.
  await menu([6, 3]);
  await click("전체 이동");
  await drag(
    [
      [6, 3],
      [7, 3],
    ],
    { shift: true },
  );
  assert.equal(
    await page(
      "document.querySelector('.interactive-board').dataset.operation",
    ),
    "move",
  );
  await escape();
  await click("화면 맞춤");

  const allArrows = () =>
    page(
      `([...document.querySelectorAll('svg [data-arrow-id]')].map(g=>({id:g.dataset.arrowId,cells:g.querySelector('polyline').getAttribute('points').split(' ').map(v=>v.split(',').map(n=>Number(n)/40+.5))})))`,
    );
  const originalArrow = (await allArrows())[0];
  const expectedCopy = original.map(([x, y]) => [x - 4, y + 2]);
  const viewMetrics = () =>
    page(
      `(()=>{const m=document.querySelector('svg.editable-board').getScreenCTM();return {x:m.e,y:m.f,sx:m.a,sy:m.d,zoom:document.querySelector('.board-view-controls span').textContent}})()`,
    );
  const assertViewUnchanged = async (before, label) => {
    await page(
      `new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`,
    );
    const after = await viewMetrics();
    for (const k of ["x", "y", "sx", "sy"])
      assert.ok(
        Math.abs(before[k] - after[k]) < 0.0001,
        label + " " + k + ": " + JSON.stringify({ before, after }),
      );
    assert.equal(
      after.zoom,
      before.zoom,
      label + " preserves the zoom readout",
    );
  };
  const beforeMessages = await viewMetrics();
  const layoutFrame = () =>
    page(
      `['.status-notice','.workspace-grid','.board-card','.canvas-wrap'].map(selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {selector,x:r.x,y:r.y,width:r.width,height:r.height}})`,
    );
  await page(
    `(()=>{const n=document.createElement('div');n.dataset.testid='layout-stress-message';n.className='notice';n.style.minHeight='120px';n.textContent='긴 안내 문구와 여러 줄의 정보가 표시되는 상황입니다. '.repeat(30);document.querySelector('.quick-actions').before(n)})()`,
  );
  await assertViewUnchanged(beforeMessages, "arbitrary multiline notice");
  await page(
    `document.querySelector('[data-testid="layout-stress-message"]').remove()`,
  );
  await assertViewUnchanged(beforeMessages, "notice removal");
  for (const [start, finish, options] of [
    [
      [6, 2],
      [2, 4],
      { alt: true, releaseAlt: true, capture: "arrow-duplicate.png" },
    ],
    [[9, 4], [5, 6], { alt: true }],
    [[6, 4], [2, 6], { alt: true }],
    [[6, 3], [2, 5], { alt: true }],
    [[9, 4], [5, 6], { menu: true }],
  ]) {
    const beforeAnalysis = await viewMetrics();
    await analyze();
    await assertViewUnchanged(beforeAnalysis, "analysis panel appearance");
    const beforeCopy = await viewMetrics();
    if (options.menu) {
      await menu(start);
      await click("복제 후 이동");
    }
    await drag([start, finish], options);
    await assertViewUnchanged(
      beforeCopy,
      "duplicate and analysis panel invalidation",
    );
    const copies = await allArrows();
    assert.equal(copies.length, 2, "copying creates exactly one new arrow");
    assert.deepEqual(
      copies[0],
      originalArrow,
      "copying never moves or reshapes the source",
    );
    assert.notEqual(copies[1].id, originalArrow.id);
    assert.deepEqual(copies[1].cells, expectedCopy);
    assert.equal(
      await page(`document.querySelector('main').dataset.selectedArrow`),
      copies[1].id,
    );
    assert.equal(
      await page(
        `document.querySelector('.interactive-board').dataset.operation`,
      ),
      "none",
    );
    await undo();
    await assertViewUnchanged(beforeCopy, "duplicate undo");
    assert.deepEqual(await allArrows(), [originalArrow]);
    await click("↷ 다시 실행");
    await assertViewUnchanged(beforeCopy, "duplicate redo");
    assert.deepEqual(
      await allArrows(),
      copies,
      "redo restores the same copied arrow ID",
    );
    await undo();
  }
  for (const finish of [
    [7, 2],
    [1, 9],
  ]) {
    const beforeError = await viewMetrics();
    const frameBeforeError = await layoutFrame();
    await drag([[6, 2], finish], { alt: true });
    await assertViewUnchanged(beforeError, "collision/bounds warning");
    assert.deepEqual(
      await layoutFrame(),
      frameBeforeError,
      "an error replaces the fixed status without moving any layout block",
    );
    assert.equal(
      await page(`document.querySelectorAll('main > .notice').length`),
      1,
      "there is only one status/error row",
    );
    assert.equal(
      await page(`!!document.querySelector('dialog[open]')`),
      false,
      "errors never open a modal automatically",
    );
    const fullError = await page(
      `document.querySelector('.notice-text').title`,
    );
    await page(
      `document.querySelector('[data-testid="notice-details"]').click()`,
    );
    await until(
      `!!document.querySelector('[data-testid="notice-dialog"][open]')`,
    );
    assert.equal(
      await page(
        `document.querySelector('.notice-detail-body pre').textContent`,
      ),
      fullError,
      "details retain the complete error",
    );
    await window.webContents
      .capturePage()
      .then((image) =>
        writeFile(path.join(directory, "notice-details.png"), image.toPNG()),
      );
    await escape();
    assert.equal(
      await page(
        `document.querySelector('[data-testid="editor-status"]').dataset.kind`,
      ),
      "error",
      "Esc closes details but preserves the error",
    );
    assert.deepEqual(await layoutFrame(), frameBeforeError);
    await window.webContents
      .capturePage()
      .then((image) =>
        writeFile(path.join(directory, "notice-fixed-row.png"), image.toPNG()),
      );
    assert.deepEqual(
      await allArrows(),
      [originalArrow],
      "overlap and out-of-bounds copies are rejected atomically",
    );
    assert.equal(
      await page(
        `document.querySelector('.interactive-board').dataset.operation`,
      ),
      "none",
    );
    await page(
      `document.querySelector('[data-testid=notice-dismiss]')?.click()`,
    );
    await assertViewUnchanged(beforeError, "warning dismissal");
    assert.deepEqual(
      await layoutFrame(),
      frameBeforeError,
      "dismissing an error does not move the layout",
    );
  }
  await click("금지 칸");
  await drag([
    [3, 6],
    [3, 6],
  ]);
  await click("기본 조작");
  await drag(
    [
      [6, 2],
      [2, 4],
    ],
    { alt: true },
  );
  assert.deepEqual(
    await allArrows(),
    [originalArrow],
    "copying into a forbidden cell does not add an arrow",
  );
  await page(`document.querySelector('[data-testid=notice-dismiss]')?.click()`);
  await undo();
  await click("금지 칸");
  await drag([
    [6, 3],
    [6, 3],
  ]);
  await click("기본 조작");
  const beforeValidationError = await layoutFrame();
  await click("Godot 검증·분석");
  await until(
    `document.querySelector('main').dataset.coreBusy==='false'&&document.querySelector('[data-testid="editor-status"]').dataset.kind==='error'&&document.querySelector('[data-testid="editor-status"]').textContent.includes('규칙 오류')`,
  );
  assert.deepEqual(
    await layoutFrame(),
    beforeValidationError,
    "rule validation errors use the same fixed row instead of a growing panel",
  );
  assert.equal(await page(`!!document.querySelector('dialog[open]')`), false);
  await page(
    `document.querySelector('[data-testid="notice-details"]').click()`,
  );
  await until(
    `!!document.querySelector('[data-testid="notice-dialog"][open]')`,
  );
  assert.ok(
    (
      await page(
        `document.querySelector('.notice-detail-body pre').textContent`,
      )
    ).includes("규칙 오류"),
  );
  await page(
    `document.querySelector('[data-testid="notice-detail-close"]').click()`,
  );
  await until(`!document.querySelector('dialog[open]')`);
  assert.equal(
    await page(
      `document.querySelector('[data-testid="editor-status"]').dataset.kind`,
    ),
    "error",
    "closing details does not dismiss validation errors",
  );
  await page(
    `document.querySelector('[data-testid="notice-dismiss"]').click()`,
  );
  assert.deepEqual(await layoutFrame(), beforeValidationError);
  await undo();
  assert.deepEqual(
    await allArrows(),
    [originalArrow],
    "closing notices never mutates the stage or adds undo entries",
  );
  await drag(
    [
      [6, 2],
      [2, 4],
    ],
    { alt: true, cancel: true },
  );
  assert.deepEqual(
    await allArrows(),
    [originalArrow],
    "Esc cancels the copy preview",
  );
  await drag(
    [
      [9, 4],
      [10, 4],
    ],
    { pressAlt: true },
  );
  assert.equal(
    (await allArrows()).length,
    1,
    "pressing Alt after drag start never switches extension into copying",
  );
  assert.deepEqual(await shape(), [...original, [10, 4]]);
  await undo();
  await drag(
    [
      [6, 4],
      [7, 5],
    ],
    { alt: true, shift: true },
  );
  assert.deepEqual(
    await allArrows(),
    [originalArrow],
    "Shift pan takes priority over Alt copy",
  );
  await click("화면 맞춤");

  // Gesture intent is locked when the button goes down, not when modifiers change.
  const camera = await page(
    `document.querySelector('.interactive-board').dataset.camera`,
  );
  await drag(
    [
      [6, 2],
      [7, 2],
    ],
    { shift: true, releaseShift: true },
  );
  assert.deepEqual(
    await shape(),
    original,
    "Shift drag on an arrow pans instead of moving it",
  );
  assert.notEqual(
    await page(`document.querySelector('.interactive-board').dataset.camera`),
    camera,
  );
  await click("화면 맞춤");
  await drag(
    [
      [6, 2],
      [7, 2],
    ],
    { shift: true, cancel: true },
  );
  assert.equal(
    await page(`document.querySelector('.interactive-board').dataset.camera`),
    camera,
    "Esc restores an unfinished pan",
  );
  await drag(
    [
      [6, 3],
      [6, 4],
    ],
    { pressShift: true },
  );
  assert.deepEqual(
    (await shape())[0],
    [6, 3],
    "pressing Shift after drag start does not switch move into pan",
  );
  await undo();
  assert.deepEqual(await shape(), original);

  const dirtyBeforeEndpointClick = await page(
    `document.querySelector('main').dataset.dirty`,
  );
  await drag([
    [6, 2],
    [6, 2],
  ]);
  assert.deepEqual(await shape(), original, "endpoint click only selects");
  assert.equal(
    await page(`document.querySelector('main').dataset.dirty`),
    dirtyBeforeEndpointClick,
  );
  await drag([
    [9, 4],
    [10, 4],
    [10, 5],
  ]);
  assert.deepEqual(
    await shape(),
    [...original, [10, 4], [10, 5]],
    "tail drag directly extends with a bend",
  );
  await undo();
  await drag([
    [6, 2],
    [6, 1],
    [5, 1],
  ]);
  assert.deepEqual(
    await shape(),
    [[5, 1], [6, 1], ...original],
    "head drag directly extends with a bend: " +
      JSON.stringify(
        await page(
          `({input:window.__boardInputLog,error:document.querySelector('.notice.error')?.textContent})`,
        ),
      ),
  );
  await undo();
  await drag(
    [
      [6, 2],
      [6, 1],
    ],
    { cancel: true },
  );
  assert.deepEqual(
    await shape(),
    original,
    "Esc cancels direct endpoint extension",
  );

  await drag([
    [9, 4],
    [6, 4],
    [6, 3],
  ]);
  assert.deepEqual(
    await shape(),
    original.slice(0, 2),
    "tail shortening follows the existing bend and stops at two cells",
  );
  await undo();
  await drag(
    [
      [6, 2],
      [6, 4],
      [7, 4],
    ],
    { capture: "endpoint-shortening.png" },
  );
  assert.deepEqual(
    await shape(),
    original.slice(3),
    "head shortening follows the existing body through its corner",
  );
  assert.ok(
    (
      await page(
        `document.querySelector('[data-testid="arrow-direction"]').textContent`,
      )
    ).includes("왼쪽"),
  );
  await undo();
  await click("↷ 다시 실행");
  assert.deepEqual(await shape(), original.slice(3));
  await undo();
  await drag([
    [6, 2],
    [6, 4],
    [9, 4],
  ]);
  assert.deepEqual(
    await shape(),
    original.slice(-2),
    "head shortening never produces a head-only arrow",
  );
  await drag([
    [8, 4],
    [9, 4],
  ]);
  assert.deepEqual(
    await shape(),
    original.slice(-2),
    "a two-cell arrow cannot shorten further",
  );
  await undo();
  assert.deepEqual(
    await shape(),
    original,
    "a blocked two-cell shortening adds no undo entry",
  );
  await drag([
    [9, 4],
    [7, 4],
    [9, 4],
  ]);
  assert.deepEqual(
    await shape(),
    original,
    "retracing a shortening restores removed cells during the same gesture",
  );
  await drag([
    [9, 4],
    [7, 4],
    [7, 5],
  ]);
  assert.deepEqual(
    await shape(),
    [...original.slice(0, 4), [7, 5]],
    "a shortened endpoint can extend in a new direction in the same gesture",
  );
  await undo();
  await drag(
    [
      [9, 4],
      [6, 4],
      [6, 3],
    ],
    { cancel: true },
  );
  assert.deepEqual(
    await shape(),
    original,
    "Esc cancels shortening without losing the original body",
  );

  await menu([6, 3]);
  await click("꼬리 쪽 꺾임 추가");
  assert.equal(
    await page(
      `document.querySelector('.interactive-board').dataset.operation`,
    ),
    "rotate",
  );
  assert.equal(
    await page(`!!document.querySelector('[data-testid="affected-group"]')`),
    true,
  );
  await drag([
    [6, 4],
    [5, 4],
  ]);
  assert.deepEqual(await shape(), [
    [6, 2],
    [6, 3],
    [5, 3],
    [5, 4],
    [5, 5],
    [5, 6],
  ]);
  assert.equal(
    await page(
      `document.querySelector('.interactive-board').dataset.operation`,
    ),
    "none",
  );
  await undo();
  await menu([6, 3]);
  await click("머리 쪽 꺾임 추가");
  await drag([
    [6, 2],
    [7, 2],
  ]);
  assert.deepEqual(await shape(), [
    [7, 3],
    [6, 3],
    [6, 4],
    [7, 4],
    [8, 4],
    [9, 4],
  ]);
  await undo();
  await menu([9, 4]);
  await click("전체 90° 회전 · 머리 고정");
  await drag([
    [9, 4],
    [4, 4],
  ]);
  assert.deepEqual(await shape(), [
    [6, 2],
    [5, 2],
    [4, 2],
    [4, 3],
    [4, 4],
    [4, 5],
  ]);
  await undo();

  await menu([6, 4]);
  await window.webContents
    .capturePage()
    .then((image) =>
      writeFile(path.join(directory, "context-menu.png"), image.toPNG()),
    );
  await click("꺾임 간격 조절");
  await drag([
    [6, 4],
    [6, 5],
  ]);
  assert.deepEqual(await shape(), [
    [6, 2],
    [6, 3],
    [6, 4],
    [6, 5],
    [7, 5],
    [8, 5],
    [9, 5],
  ]);
  await undo();
  await menu([6, 4]);
  await click("꺾임 간격 조절");
  await drag([
    [6, 4],
    [6, 2],
  ]);
  assert.deepEqual(
    await shape(),
    [
      [6, 2],
      [6, 3],
      [7, 3],
      [8, 3],
      [9, 3],
    ],
    "spacing at the head keeps at least one grid edge",
  );
  await undo();

  await drag(
    [
      [6, 4],
      [6, 2],
      [6, 1],
    ],
    { capture: "corner-head-crossing.png" },
  );
  const reversedShape = [
    [6, 2],
    [6, 1],
    [7, 1],
    [8, 1],
    [9, 1],
  ];
  assert.deepEqual(
    await shape(),
    reversedShape,
    "dragging the corner beyond the head rebuilds the segment on the opposite side",
  );
  assert.ok(
    (
      await page(
        `document.querySelector('[data-testid="arrow-direction"]').textContent`,
      )
    ).includes("아래"),
    "the head direction automatically reverses",
  );
  await undo();
  assert.deepEqual(await shape(), original);
  await click("↷ 다시 실행");
  assert.deepEqual(await shape(), reversedShape);
  await undo();
  await drag(
    [
      [6, 4],
      [6, 1],
    ],
    { cancel: true },
  );
  assert.deepEqual(
    await shape(),
    original,
    "Esc preserves the original direction after crossing the head",
  );

  await drag([
    [6, 4],
    [9, 4],
  ]);
  assert.deepEqual(
    await shape(),
    [
      [8, 2],
      [8, 3],
      [8, 4],
      [9, 4],
    ],
    "exact tail contact retains one edge",
  );
  await undo();
  const tailReversed = [
    [10, 2],
    [10, 3],
    [10, 4],
    [9, 4],
  ];
  await drag(
    [
      [6, 4],
      [9, 4],
      [10, 4],
    ],
    { capture: "corner-tail-crossing.png" },
  );
  assert.deepEqual(
    await shape(),
    tailReversed,
    "the corner can continue past the tail",
  );
  assert.ok(
    (
      await page(
        `document.querySelector('[data-testid="arrow-direction"]').textContent`,
      )
    ).includes("위"),
    "tail crossing keeps the head direction derived from its own segment",
  );
  await undo();
  await click("↷ 다시 실행");
  assert.deepEqual(await shape(), tailReversed);
  await undo();
  await drag(
    [
      [6, 4],
      [10, 4],
    ],
    { cancel: true },
  );
  assert.deepEqual(await shape(), original, "Esc cancels tail crossing");
  await drag([
    [6, 4],
    [10, 4],
    [6, 4],
  ]);
  assert.deepEqual(
    await shape(),
    original,
    "crossing the tail then returning to origin creates no edit",
  );
  assert.equal(
    await page(
      `document.querySelector('.interactive-board').dataset.operation`,
    ),
    "none",
  );

  await menu([6, 4]);
  await click("꺾임 간격 조절");
  await drag([
    [6, 4],
    [7, 4],
  ]);
  assert.deepEqual(
    await shape(),
    [
      [7, 2],
      [7, 3],
      [7, 4],
      [8, 4],
      [9, 4],
    ],
    "horizontal spacing moves the head group and keeps the tail fixed",
  );
  await undo();
  await menu([6, 4]);
  await click("꺾임 간격 조절");
  await drag(
    [
      [6, 4],
      [7, 5],
    ],
    { capture: "bend-spacing-preview.png" },
  );
  assert.deepEqual(
    await shape(),
    [
      [7, 2],
      [7, 3],
      [7, 4],
      [7, 5],
      [8, 5],
      [9, 5],
    ],
    "diagonal drag adjusts both sides in one edit",
  );
  await undo();
  await menu([6, 4]);
  await click("꺾임 간격 조절");
  await drag(
    [
      [6, 4],
      [7, 5],
    ],
    { cancel: true },
  );
  assert.deepEqual(
    await shape(),
    original,
    "Esc cancels both group changes together",
  );

  const dirtyBeforeCornerClick = await page(
    `document.querySelector('main').dataset.dirty`,
  );
  await drag([
    [6, 4],
    [6, 4],
  ]);
  assert.deepEqual(
    await shape(),
    original,
    "corner click only selects without arming a tool",
  );
  assert.equal(
    await page(`document.querySelector('main').dataset.dirty`),
    dirtyBeforeCornerClick,
  );
  assert.equal(
    await page(
      `document.querySelector('.interactive-board').dataset.operation`,
    ),
    "none",
  );
  await drag(
    [
      [6, 4],
      [7, 5],
    ],
    { pressShift: true, capture: "corner-left-drag.png" },
  );
  assert.deepEqual(
    await shape(),
    [
      [7, 2],
      [7, 3],
      [7, 4],
      [7, 5],
      [8, 5],
      [9, 5],
    ],
    "left corner drag directly changes both gaps even when Shift is pressed later",
  );
  await undo();
  assert.deepEqual(await shape(), original, "one undo restores both groups");
  await drag(
    [
      [6, 4],
      [7, 5],
    ],
    { cancel: true },
  );
  assert.deepEqual(
    await shape(),
    original,
    "Esc cancels direct corner manipulation",
  );
  const cornerCamera = await page(
    `document.querySelector('.interactive-board').dataset.camera`,
  );
  await drag(
    [
      [6, 4],
      [7, 5],
    ],
    { shift: true },
  );
  assert.deepEqual(
    await shape(),
    original,
    "Shift at corner drag start still pans rather than changing gaps",
  );
  assert.notEqual(
    await page(`document.querySelector('.interactive-board').dataset.camera`),
    cornerCamera,
  );
  await click("화면 맞춤");

  await menu([9, 4]);
  await click("꼬리 연장·축소");
  assert.deepEqual(
    await shape(),
    original,
    "arming endpoint editing preserves the original shape",
  );
  await drag([
    [9, 4],
    [10, 4],
    [10, 5],
    [11, 5],
  ]);
  assert.deepEqual(await shape(), [...original, [10, 4], [10, 5], [11, 5]]);
  await undo();
  await menu([6, 2]);
  await click("머리 연장·축소");
  await drag([
    [6, 2],
    [6, 1],
    [5, 1],
  ]);
  assert.deepEqual(await shape(), [[5, 1], [6, 1], ...original]);
  assert.ok(
    (
      await page(
        `document.querySelector('[data-testid="arrow-direction"]').textContent`,
      )
    ).includes("왼쪽"),
  );
  await undo();

  // Collision rejection and cancellation both preserve the full original arrow.
  await menu([9, 4]);
  await click("꼬리 연장·축소");
  await drag([
    [9, 4],
    [9, 3],
    [6, 3],
  ]);
  assert.deepEqual(
    await shape(),
    original,
    "self-overlap does not alter the original",
  );
  await escape();
  await page(`document.querySelector('[data-testid=notice-dismiss]')?.click()`);
  await menu([9, 4]);
  await click("꼬리 연장·축소");
  await drag(
    [
      [9, 4],
      [10, 4],
      [10, 5],
    ],
    { cancel: true },
  );
  assert.deepEqual(
    await shape(),
    original,
    "Esc during held drag discards the preview",
  );
  await menu([6, 4]);
  await click("꺾임 간격 조절");
  await drag(
    [
      [6, 4],
      [6, 5],
    ],
    { wait: false },
  );
  await until(`document.querySelector('main').dataset.coreBusy==='true'`);
  await escape();
  await until(
    `document.querySelector('main').dataset.coreBusy==='false'&&document.querySelector('.interactive-board').dataset.pending==='false'`,
  );
  assert.deepEqual(
    await shape(),
    original,
    "Esc while Godot is checking never applies a late result",
  );

  const pos = await screen([7, 4]);
  const anchor = await page(
    `(()=>{const m=document.querySelector('svg').getScreenCTM();const v=new DOMPoint(${pos.x},${pos.y}).matrixTransform(m.inverse());return[v.x,v.y]})()`,
  );
  await page(
    `document.querySelector('svg.editable-board').dispatchEvent(new WheelEvent('wheel',{clientX:${pos.x},clientY:${pos.y},deltaY:-160,bubbles:true,cancelable:true}))`,
  );
  await delay(100);
  const after = await page(
    `(()=>{const m=document.querySelector('svg').getScreenCTM();const v=new DOMPoint(${pos.x},${pos.y}).matrixTransform(m.inverse());return[v.x,v.y]})()`,
  );
  assert.ok(
    Math.abs(anchor[0] - after[0]) < 0.01 &&
      Math.abs(anchor[1] - after[1]) < 0.01,
    "wheel zoom stays anchored to pointer",
  );
  await click("화면 맞춤");
  await click("영역 관리");
  await drag(
    [
      [2, 6],
      [4, 7],
    ],
    { cancel: true },
  );
  assert.equal(
    await page(`document.querySelector('main').dataset.mode`),
    "region",
    "Esc cancels a gesture while preserving region workspace selection",
  );
  assert.equal(
    (await store.load()).stages.find((s) => s.id === fixtureId).candidates[0]
      .versions.length,
    1,
    "previews and undo do not create candidate versions",
  );

  await click("화살 배치");
  await menu([6, 4]);
  await click("꺾임 간격 조절");
  await delay(250);
  await window.webContents
    .capturePage()
    .then((image) =>
      writeFile(path.join(directory, "interaction.png"), image.toPNG()),
    );
  await escape();
  await page(
    `(()=>{const button=[...document.querySelectorAll('.stage-row')].find(b=>b.textContent.includes(${JSON.stringify(originalStage)}));button.click();})()`,
  );
  await until(`!!document.querySelector('dialog[open]')`);
  await click("변경 버리고 계속");
  await until(
    `document.querySelector('h1').textContent===${JSON.stringify(originalStage)}`,
  );
  await analyze();
  await delay(300);
  await store.queue;
  const savedFixture = (await store.load()).stages.find(
    (s) => s.id === fixtureId,
  );
  const preservedRecovery = {
    stageId: fixtureId,
    candidateId: savedFixture.candidates[0].id,
    draft: structuredClone(savedFixture.candidates[0].versions[0].draft),
  };
  await store.recover(preservedRecovery);
  const loaded = new Promise((resolve) =>
    window.webContents.once("did-finish-load", resolve),
  );
  window.webContents.reload();
  await loaded;
  await until(`!!document.querySelector('dialog[open]')`);
  await escape();
  await until(`!!document.querySelector('.recovery-gate')`);
  assert.equal(
    await page(`document.querySelector('.app-shell').hasAttribute('inert')`),
    true,
  );
  assert.deepEqual(
    await store.recovery(),
    preservedRecovery,
    "Esc preserves recovery without silently discarding or overwriting it",
  );
  await click("복구 창 열기");
  await until(`!!document.querySelector('dialog[open]')`);
  await click("복구본을 버리고 계속");
  await page(
    `(()=>{const b=[...document.querySelectorAll('.stage-row')].find(b=>b.textContent.includes(${JSON.stringify(fixtureId)}));b.click();})()`,
  );
  await until(
    `document.querySelector('h1').textContent===${JSON.stringify(fixtureId)}`,
  );
  assert.ok(
    (
      await page(
        `document.querySelector('[data-testid="editor-status"]').textContent`,
      )
    ).includes("화살표를 선택하거나"),
    "fresh startup reserves the status area before any edit",
  );
  const viewport = () =>
    page(
      `(()=>{const s=document.querySelector('svg.editable-board'),m=s.getScreenCTM(),r=s.getBoundingClientRect();return {scaleX:m.a,scaleY:m.d,left:r.left,top:r.top,width:r.width,height:r.height,camera:document.querySelector('.interactive-board').dataset.camera}})()`,
    );
  const beforeFirstEdit = await viewport();
  const firstStart = await screen([6, 4]),
    firstEnd = await screen([7, 5]);
  await pointer("mouseDown", firstStart);
  await pointer("mouseMove", firstEnd, "left", ["leftButtonDown"]);
  assert.deepEqual(
    await viewport(),
    beforeFirstEdit,
    "the first edit hint never changes board size, scale, or camera",
  );
  await pointer("mouseUp", firstEnd);
  await until(
    `document.querySelector('main').dataset.coreBusy==='false'&&document.querySelector('.interactive-board').dataset.pending==='false'`,
  );
  assert.deepEqual(
    await viewport(),
    beforeFirstEdit,
    "the first committed edit never resizes the board",
  );
  assert.deepEqual(
    await shape(),
    [
      [7, 2],
      [7, 3],
      [7, 4],
      [7, 5],
      [8, 5],
      [9, 5],
    ],
    "the first drag keeps its intended grid position",
  );
  await click("기본 조작");
  assert.deepEqual(
    await viewport(),
    beforeFirstEdit,
    "a longer tool hint does not reflow the board",
  );
  await page(
    `(()=>{const button=[...document.querySelectorAll('.stage-row')].find(b=>b.textContent.includes(${JSON.stringify(originalStage)}));button.click();})()`,
  );
  await until(`!!document.querySelector('dialog[open]')`);
  await click("변경 버리고 계속");
  await until(
    `document.querySelector('h1').textContent===${JSON.stringify(originalStage)}`,
  );
  await analyze();
  return {
    contextMenu: true,
    shiftPan: true,
    lockedGesture: true,
    quarterTurn: true,
    groupBend: true,
    bendSpacing: true,
    twoAxisBendSpacing: true,
    unchangedSpacingExits: true,
    commonGestureCompletion: true,
    duplicateArrow: true,
    layoutIndependentCamera: true,
    fixedErrorNotice: true,
    directCornerDrag: true,
    cornerHeadCrossing: true,
    cornerTailCrossing: true,
    hoverPartHints: true,
    headTailExtension: true,
    directEndpointExtension: true,
    endpointShortening: true,
    escapeDrag: true,
    escapePendingCore: true,
    escapeRecovery: true,
    pointerZoom: true,
    firstEditViewportStable: true,
  };
}
