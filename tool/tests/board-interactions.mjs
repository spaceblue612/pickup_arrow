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
    } = {},
  ) {
    const positions = [];
    for (const c of cells) positions.push(await screen(c));
    if (shift) await key("Shift");
    await pointer("mouseDown", positions[0], "left", shift ? ["shift"] : []);
    if (releaseShift) await key("Shift", "keyUp");
    if (pressShift) await key("Shift");
    for (const pos of positions.slice(1))
      await pointer("mouseMove", pos, "left", [
        "leftButtonDown",
        ...((shift && !releaseShift) || pressShift ? ["shift"] : []),
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
    await pointer("mouseUp", positions.at(-1));
    if (shift || pressShift) await key("Shift", "keyUp");
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
  for (const viaMenu of [false, true]) {
    if (viaMenu) {
      await menu([6, 4]);
      await click("꺾임 간격 조절");
    }
    await drag([
      [6, 4],
      [7, 5],
      [6, 4],
    ]);
    assert.deepEqual(
      await shape(),
      original,
      "returning to the starting corner keeps the original shape",
    );
    assert.equal(
      await page(
        `document.querySelector('.interactive-board').dataset.operation`,
      ),
      "none",
      "unchanged spacing exits modification mode",
    );
    assert.equal(
      await page(
        `document.querySelector('.interactive-board').dataset.editing`,
      ),
      "false",
    );
    assert.equal(
      await page(`document.querySelector('main').dataset.dirty`),
      "false",
      "unchanged spacing does not dirty the saved draft",
    );
    assert.equal(
      await undoState(),
      historyBeforeRoundTrip,
      "unchanged spacing leaves undo/redo state untouched",
    );
  }

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
    "head drag directly extends with a bend",
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
  await page(`document.querySelector('.notice.error button')?.click()`);
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
  await click("영역");
  await drag(
    [
      [2, 6],
      [4, 7],
    ],
    { cancel: true },
  );
  assert.equal(
    await page(`document.querySelector('main').dataset.mode`),
    "auto",
    "Esc exits a dedicated tool as well as its gesture",
  );
  assert.equal(
    (await store.load()).stages.find((s) => s.id === fixtureId).candidates[0]
      .versions.length,
    1,
    "previews and undo do not create candidate versions",
  );

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
    directCornerDrag: true,
    cornerHeadCrossing: true,
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
