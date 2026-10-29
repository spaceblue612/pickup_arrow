import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";

export async function runLayout(
  {
    window,
    store,
    directory,
    page,
    until,
    click,
    delay,
    setTextSize,
    drag,
    analyze,
  },
  fixture,
) {
  const saved = await store.load();
  const draft = fixture.draft;
  const arrow = draft.stage.arrows.find((arrow) =>
    arrow.id.startsWith("ARROW-"),
  );
  await analyze();
  const layouts = [];
  // Measure the normal workspace without any earlier notice affecting layout.
  await page(`document.querySelector('[data-testid=notice-dismiss]')?.click()`);
  window.showInactive();
  await delay(300);
  for (const [width, height] of [
    [1100, 740],
    [1280, 800],
    [1680, 1080],
    [1920, 1080],
  ]) {
    window.setContentSize(width, height);
    await delay(300);
    await click("화면 맞춤");
    await page(
      `new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`,
    );
    const layout = await page(`(()=>{
      const svg=document.querySelector('svg.editable-board'), m=svg.getScreenCTM(), v=svg.viewBox.baseVal;
      const card=document.querySelector('.board-card').getBoundingClientRect();
      const inspector=document.querySelector('[data-testid="stage-inspector"]').getBoundingClientRect();
      const summary=document.querySelector('[data-testid="intent-summary"]').getBoundingClientRect();
      const viewport=svg.getBoundingClientRect();
      const grid=svg.querySelector('rect'),gw=Number(grid.getAttribute('width')),gh=Number(grid.getAttribute('height'));
      return {width:innerWidth,height:innerHeight,boardWidth:gw*m.a,boardHeight:gh*m.d,
        fittedBoardHeight:Math.min(viewport.height,viewport.width*gh/gw),
        boardTop:card.top,inspectorTop:inspector.top,summaryBottom:summary.bottom,summaryHeight:summary.height,
        pageOverflow:document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight,
        inspectorFirst:document.querySelector('.workspace-right').firstElementChild.matches('.stage-inspector')};
    })()`);
    assert.equal(layout.pageOverflow, false, JSON.stringify(layout));
    assert.equal(layout.inspectorFirst, true);
    assert.ok(
      Math.abs(layout.boardTop - layout.inspectorTop) <= 1,
      JSON.stringify(layout),
    );
    assert.ok(layout.summaryBottom < layout.height, JSON.stringify(layout));
    assert.ok(layout.summaryHeight < 150, JSON.stringify(layout));
    assert.ok(
      layout.boardHeight > 300 &&
        Math.abs(layout.boardHeight - layout.fittedBoardHeight) < 1,
      JSON.stringify(layout),
    );
    await click("기본 조작");
    await drag([11, 8], [11, 8]);
    assert.ok(
      (
        await page(`document.querySelector('.arrow-inspector').textContent`)
      ).includes(arrow.id),
      "resized board coordinates still select the intended arrow",
    );
    await page(
      `document.querySelector('[data-testid="intent-detail"]').click()`,
    );
    await until(`document.querySelector('[data-testid="editor-dialog"]').open`);
    assert.equal(
      await page(
        `(()=>{const d=document.querySelector('[data-testid="editor-dialog"]'), r=d.getBoundingClientRect(), f=d.querySelector('.dialog-footer').getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight+1&&f.bottom<=innerHeight+1;})()`,
      ),
      true,
      "dialog and close controls fit the viewport",
    );
    await click("작업으로 돌아가기");
    await until(
      `!document.querySelector('[data-testid="editor-dialog"]').open`,
    );
    if (width === 1100) {
      await page(
        `document.querySelector('[aria-label="에디터 환경설정"]').click()`,
      );
      await until(
        `document.querySelector('[data-testid="editor-dialog"]').open`,
      );
      await setTextSize(19);
      await until(`parseFloat(getComputedStyle(document.body).fontSize)===19`);
      assert.equal(
        await page(
          `document.documentElement.scrollWidth<=innerWidth&&document.querySelector('.preview-footer').getBoundingClientRect().bottom<=innerHeight+1`,
        ),
        true,
        "largest text still keeps small-window controls in bounds",
      );
      await click("작업으로 돌아가기");
      await until(`parseFloat(getComputedStyle(document.body).fontSize)===15`);
    }
    layouts.push(layout);
    await window.webContents
      .capturePage()
      .then((image) =>
        writeFile(path.join(directory, `layout-${width}.png`), image.toPNG()),
      );
  }
  window.setContentSize(1680, 1080);
  await delay(300);
  await page(`document.querySelector('[data-testid="intent-detail"]').click()`);
  await until(`document.querySelector('[data-testid="editor-dialog"]').open`);
  assert.equal(
    await page(`document.querySelectorAll('.detail-metrics > section').length`),
    3,
  );
  await page(
    `(()=>{const s=document.querySelector('select[aria-label="분석 영역 선택"]');s.value='';s.dispatchEvent(new Event('change',{bubbles:true}));})()`,
  );
  assert.ok(
    (
      await page(
        `document.querySelector('[data-testid="intent-summary"]').textContent`,
      )
    ).includes("미선택"),
  );
  await page(
    `(()=>{const s=document.querySelector('select[aria-label="분석 영역 선택"]');s.value=${JSON.stringify(draft.regions[0].id)};s.dispatchEvent(new Event('change',{bubbles:true}));})()`,
  );
  assert.ok(
    (
      await page(`document.querySelector('.region-detail').textContent`)
    ).includes("35칸 · 소속 화살표 3개 · 제거 가능 0개"),
  );
  await page(
    `new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`,
  );
  await delay(300);
  await window.webContents
    .capturePage()
    .then((image) =>
      writeFile(path.join(directory, "intent-detail.png"), image.toPNG()),
    );
  await click("이 영역을 보드에서 보기");
  await until(`!document.querySelector('[data-testid="editor-dialog"]').open`);
  assert.ok(
    (
      await page(
        `document.querySelector('[data-testid="intent-summary"]').textContent`,
      )
    ).includes("영역 1"),
  );
  assert.deepEqual(
    await store.load(),
    saved,
    "opening details and changing query region never mutates saved candidates",
  );
  return {
    responsiveLayouts: layouts,
    compactInspector: true,
    intentRegionDetails: true,
  };
}
