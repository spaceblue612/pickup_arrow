import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";

export async function runPlacementControls({
  window,
  store,
  directory,
  page,
  until,
  click,
  delay,
}) {
  const saved = await store.load();
  const recovery = await store.recovery();
  const original =
    await page(`({ dirty: document.querySelector('main').dataset.dirty,
    shapes: [...document.querySelectorAll('svg.editable-board [data-arrow-id] polyline')].map(node=>node.getAttribute('points')),
    undo: [...document.querySelectorAll('button')].find(b => b.textContent.trim()==='↶ 실행 취소').disabled })`);
  await page(
    `document.querySelector('[data-testid="candidate-history"] summary').click()`,
  );
  await until(
    `document.querySelector('[data-testid="candidate-history"]').open`,
  );
  await click("자동 배치");
  await until(
    `document.querySelector('[data-testid="placement-dock"]').open && !document.querySelector('[data-testid="candidate-history"]').open`,
  );
  // Middle-button panning must also work while clicks select placement regions.
  const beforePan = await page(`document.querySelector('svg.editable-board').getAttribute('viewBox')`);
  const panStart = await page(`(()=>{const r=document.querySelector('svg.editable-board').getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})()`);
  window.webContents.sendInputEvent({ type: "mouseDown", ...panStart, button: "middle", clickCount: 1 });
  window.webContents.sendInputEvent({ type: "mouseMove", x: panStart.x + 60, y: panStart.y + 40, button: "middle" });
  window.webContents.sendInputEvent({ type: "mouseUp", x: panStart.x + 60, y: panStart.y + 40, button: "middle", clickCount: 1 });
  await until(`document.querySelector('svg.editable-board').getAttribute('viewBox') !== ${JSON.stringify(beforePan)}`);
  assert.equal(
    await page(`document.querySelectorAll('.placement-dock tbody tr').length`),
    saved.stages.at(-1).candidates[0].versions.at(-1).draft.regions.length + 1,
  );
  assert.equal(
    await page(
      `document.querySelector('[data-testid="placement-generate"]').textContent.trim()`,
    ),
    "랜덤 생성",
  );
  assert.equal(
    await page(
      `document.querySelector('[data-testid="placement-generate"]').disabled`,
    ),
    false,
    "generation is available",
  );
  assert.equal(
    await page(`document.querySelectorAll('.placement-dock input').length`),
    (await page(
      `document.querySelectorAll('.placement-dock tbody tr').length`,
    )) * 6 + 1,
  );

  assert.equal(await page(`document.querySelector('.placement-settings input[aria-label$=" 1단계 점유율"]').value`), "30");
  assert.equal(await page(`[...document.querySelectorAll('.placement-dock input[aria-label$=" 1단계 점유율"]')].every(input=>input.value==='30')`), true);
    await click("＋ 길이 추가");
  assert.equal(await page(`document.querySelectorAll('.placement-rule').length`), 1);
  await page(`(()=>{const inputs=document.querySelectorAll('.placement-rule input');for(const [input,value] of [[inputs[0],'20'],[inputs[1],'5']]){Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));}})()`);
  await until(`document.querySelector('.placement-dock tbody tr').textContent.includes('20타일 · 5개')`);
  await page(`document.querySelector('[aria-label="길이 규칙 삭제"]').click()`);
  await until(`document.querySelector('.placement-dock tbody tr').textContent.includes('기초 랜덤')`);

  // Use the real native input setter so React receives the same event as typing.
  const region = await page(
    `document.querySelectorAll('.placement-dock tbody tr')[1].dataset.placementRegion`,
  );
  await page(`document.querySelectorAll('.placement-row-target')[1].click()`);
  await until(
    `document.querySelector('select[aria-label="자동 배치 조절 대상"]').value === ${JSON.stringify(region)}`,
  );
  assert.equal(
    await page(
      `document.querySelector('.placement-action-target strong').textContent`,
    ),
    saved.stages.at(-1).candidates[0].versions.at(-1).draft.regions[0].name,
  );
  await page(`(()=>{const input=document.querySelector('.placement-settings input[aria-label$=" 채움률"]');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'70');
    input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await until(
    `document.querySelectorAll('.placement-dock tbody tr')[1].querySelector("input[aria-label$=' 채움률']").value === '70'`,
  );
  await page(`document.querySelectorAll('.placement-row-target')[0].click()`);
  await until(
    `document.querySelector('select[aria-label="자동 배치 조절 대상"]').value === ''`,
  );
  assert.equal(
    await page(
      `document.querySelector('.placement-settings input[aria-label$=" 채움률"]').value`,
    ),
    "",
    "targets have independent temporary inputs",
  );

  // A board click in this panel selects a region rather than moving or drawing geometry.
  const cell = saved.stages.at(-1).candidates[0].versions.at(-1).draft
    .regions[0].cells[0];
  const position =
    await page(`(()=>{const m=document.querySelector('svg.editable-board').getScreenCTM(),
    p=new DOMPoint((${cell[0]}-.5)*40,(${cell[1]}-.5)*40).matrixTransform(m);return {x:Math.round(p.x),y:Math.round(p.y)}})()`);
  window.webContents.sendInputEvent({
    type: "mouseDown",
    ...position,
    button: "left",
    clickCount: 1,
  });
  window.webContents.sendInputEvent({
    type: "mouseUp",
    ...position,
    button: "left",
    clickCount: 1,
  });
  await until(
    `document.querySelector('select[aria-label="자동 배치 조절 대상"]').value === ${JSON.stringify(region)}`,
  );
  assert.equal(
    await page(
      `document.querySelector('.placement-settings input[aria-label$=" 채움률"]').value`,
    ),
    "70",
  );

  const sizes = [];
  for (const [width, height] of [
    [1100, 740],
    [1680, 1080],
  ]) {
    // Wayland may apply the first resize after mapping the test window. Wait
    // for the requested content size rather than measuring the previous one.
    let settled = false;
    for (let attempt = 0; attempt < 10; attempt++) {
      window.setContentSize(width, height);
      await delay(100);
      settled = await page(
        `Math.abs(innerWidth-${width})<=24 && innerHeight===${height}`,
      );
      if (settled) break;
    }
    assert.equal(settled, true, `window resize settles at ${width}×${height}`);
    await page(
      `new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`,
    );
    const bounds =
      await page(`(()=>{const dock=document.querySelector('.placement-dock').getBoundingClientRect(),
      canvas=document.querySelector('.canvas-wrap').getBoundingClientRect(), table=document.querySelector('.placement-table-scroll'),
      button=document.querySelector('[data-testid="placement-generate"]').getBoundingClientRect();
      return {width:innerWidth, height:innerHeight, overflow:document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight,
        dockHeight:dock.height, bottom:dock.bottom, boardHeight:canvas.height, scrolls:table.scrollHeight>table.clientHeight,
        generateVisible:button.width>0&&button.top>=dock.top&&button.bottom<=dock.bottom&&button.right<=innerWidth};})()`);
    assert.equal(bounds.overflow, false);
    assert.equal(
      bounds.generateVisible,
      true,
      "generate action stays visible without scrolling the inspector",
    );
    assert.ok(
      bounds.bottom <= bounds.height + 1 && bounds.boardHeight >= 120,
      JSON.stringify(bounds),
    );
    sizes.push(bounds);
    await writeFile(
      path.join(directory, `placement-${width}.png`),
      (await window.webContents.capturePage()).toPNG(),
    );
  }
  const beforeHeight = await page(
    `document.querySelector('.placement-dock').getBoundingClientRect().height`,
  );
  await page(
    `document.querySelector('.placement-resize').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true}))`,
  );
  await until(
    `document.querySelector('.placement-dock').getBoundingClientRect().height > ${beforeHeight}`,
  );
  await page(`document.querySelector('[aria-label="자동 배치 닫기"]').click()`);
  await until(
    `!document.querySelector('[data-testid="placement-dock"]').open && !!document.querySelector('[data-testid="stage-inspector"]')`,
  );
  await page(`document.querySelector('.placement-dock summary').click()`);
  await until(`document.querySelector('[data-testid="placement-dock"]').open`);
  await page(
    `document.querySelector('[data-testid="candidate-history"] summary').click()`,
  );
  await until(
    `document.querySelector('[data-testid="candidate-history"]').open && !document.querySelector('[data-testid="placement-dock"]').open`,
  );
  await page(
    `document.querySelector('[data-testid="candidate-history"] summary').click()`,
  );
  await until(
    `!document.querySelector('[data-testid="candidate-history"]').open`,
  );
  assert.equal(
    await page(`document.querySelector('main').dataset.dirty`),
    original.dirty,
  );
  assert.deepEqual(
    await page(
      `[...document.querySelectorAll('svg.editable-board [data-arrow-id] polyline')].map(node=>node.getAttribute('points'))`,
    ),
    original.shapes,
    "selecting regions in automatic placement never edits arrow geometry",
  );
  assert.equal(
    await page(
      `[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='↶ 실행 취소').disabled`,
    ),
    original.undo,
  );
  await store.queue;
  assert.deepEqual(
    await store.load(),
    saved,
    "UI inputs never change candidates or versions",
  );
  assert.deepEqual(
    await store.recovery(),
    recovery,
    "UI inputs never create recovery changes",
  );
  const fixture = saved.stages.at(-1).candidates[0].versions.at(-1).draft;
  const regionCells = new Set(fixture.regions[0].cells.map(cell => cell.join(",")));
  const keptIds = fixture.stage.arrows.filter(arrow => !arrow.cells.every(cell => regionCells.has(cell.join(",")))).map(arrow => arrow.id).sort();
  await page(`document.querySelector('[data-testid="placement-open"]').click()`);
  await page(`document.querySelectorAll('.placement-row-target')[1].click()`);
  await page(`document.querySelector('[data-testid="clear-region-arrows"]').click()`);
  await until(`document.querySelectorAll('svg.editable-board [data-arrow-id]').length === ${keptIds.length}`);
  assert.deepEqual(await page(`[...document.querySelectorAll('svg.editable-board [data-arrow-id]')].map(node=>node.dataset.arrowId).sort()`), keptIds);
  await click("↶ 실행 취소");
  await until(`document.querySelectorAll('svg.editable-board [data-arrow-id]').length === ${fixture.stage.arrows.length}`);
  await page(`document.querySelector('[data-testid="clear-board-arrows"]').click()`);
  await until(`document.querySelectorAll('svg.editable-board [data-arrow-id]').length === 0`);
  await click("↶ 실행 취소");
  await until(`document.querySelectorAll('svg.editable-board [data-arrow-id]').length === ${fixture.stage.arrows.length}`);
  assert.deepEqual(await page(`[...document.querySelectorAll('svg.editable-board [data-arrow-id] polyline')].map(node=>node.getAttribute('points'))`), original.shapes);
  return {
    bulkDeleteUndo: true,
    independentInputs: true,
    regionSelection: true,
    noPersistence: true,
    resizable: true,
    sizes,
  };
}
