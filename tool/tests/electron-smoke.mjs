import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { runBoardInteractions } from "./board-interactions.mjs";

export async function runSmoke(window, store, directory) {
  const page = (source) => window.webContents.executeJavaScript(source);
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  async function until(source) {
    for (let i = 0; i < 100; i++) {
      if (await page(source)) return;
      await delay(100);
    }
    throw new Error("UI wait timed out: " + source);
  }
  async function click(label) {
    await page(
      `(()=>{const button=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(label)});if(!button||button.disabled)throw Error('Cannot click '+${JSON.stringify(label)});button.click();})()`,
    );
    await delay(100);
  }
  async function setTextSize(size) {
    for (let i = 0; i < 12; i++) {
      const current = await page(
        `parseFloat(getComputedStyle(document.body).fontSize)`,
      );
      if (current === size) return;
      await click(current < size ? "+1px" : "−1px");
    }
    throw Error("Text size did not reach " + size);
  }
  async function save() {
    await click("저장 ↗");
    await until(`!document.body.innerText.includes('저장 중…')`);
    await store.queue;
  }
  async function analyze() {
    await click("Godot 검증·분석");
    await until(
      `document.querySelector('main').dataset.coreBusy==='false'&&document.querySelector('main').dataset.analysis==='solved'`,
    );
  }
  async function drag(from, to) {
    const points = await page(
      `(()=>{const m=document.querySelector('svg.editable-board').getScreenCTM();return ${JSON.stringify([from, to])}.map(c=>{const p=new DOMPoint((c[0]-.5)*40,(c[1]-.5)*40).matrixTransform(m);return {x:Math.round(p.x),y:Math.round(p.y)}})})()`,
    );
    window.webContents.sendInputEvent({
      type: "mouseDown",
      ...points[0],
      button: "left",
      clickCount: 1,
    });
    await delay(70);
    if (Math.abs(from[0] - to[0]) + Math.abs(from[1] - to[1]) > 1) {
      window.webContents.sendInputEvent({
        type: "mouseMove",
        ...points[1],
        modifiers: ["leftButtonDown"],
      });
      await delay(70);
    } else {
      window.webContents.sendInputEvent({
        type: "mouseMove",
        ...points[1],
        modifiers: ["leftButtonDown"],
      });
      await delay(70);
    }
    window.webContents.sendInputEvent({
      type: "mouseUp",
      ...points[1],
      button: "left",
      clickCount: 1,
    });
    await delay(200);
    await until(`document.querySelector('main').dataset.coreBusy==='false'`);
  }
  async function wholeMove(from, to) {
    const pos = await page(
      `(()=>{const m=document.querySelector('svg.editable-board').getScreenCTM();const p=new DOMPoint((${from[0]}-.5)*40,(${from[1]}-.5)*40).matrixTransform(m);return {x:Math.round(p.x),y:Math.round(p.y)}})()`,
    );
    window.webContents.sendInputEvent({
      type: "mouseDown",
      ...pos,
      button: "right",
      clickCount: 1,
    });
    window.webContents.sendInputEvent({
      type: "mouseUp",
      ...pos,
      button: "right",
      clickCount: 1,
    });
    await until(`!!document.querySelector('[role="menu"]')`);
    await click("전체 이동");
    await drag(from, to);
  }
  await until(
    `!!document.querySelector('[data-testid="sample"]')&&!document.querySelector('[data-testid="sample"]').disabled`,
  );
  assert.equal(
    await page(`parseFloat(getComputedStyle(document.body).fontSize)`),
    15,
    "default body text is 15px",
  );
  await page(
    `document.querySelector('[aria-label="에디터 환경설정"]').click()`,
  );
  await until(`document.querySelector('[data-testid="editor-dialog"]').open`);
  await setTextSize(13);
  assert.equal(
    await page(
      `document.querySelector('[aria-label="글자 1px 줄이기"]').disabled`,
    ),
    true,
  );
  await setTextSize(19);
  assert.equal(
    await page(
      `document.querySelector('[aria-label="글자 1px 키우기"]').disabled`,
    ),
    true,
  );
  await page(
    `document.querySelector('[aria-label="글자 1px 키우기"]').click()`,
  );
  assert.equal(
    await page(`parseFloat(getComputedStyle(document.body).fontSize)`),
    19,
    "disabled increment cannot exceed maximum",
  );
  assert.equal(
    await page(
      `document.querySelector('.appearance-settings').textContent.includes('이전보다')`,
    ),
    false,
  );
  await click("기본값");
  assert.equal(
    await page(`parseFloat(getComputedStyle(document.body).fontSize)`),
    15,
  );
  await setTextSize(17);
  await until(`parseFloat(getComputedStyle(document.body).fontSize)===17`);
  await click("환경설정 저장");
  await until(`!document.querySelector('[data-testid="editor-dialog"]').open`);
  assert.equal(
    JSON.parse(await readFile(path.join(directory, "settings.json"), "utf8"))
      .textSizeOffset,
    4,
  );
  const reloaded = new Promise((resolve) =>
    window.webContents.once("did-finish-load", resolve),
  );
  window.webContents.reload();
  await reloaded;
  await until(
    `document.querySelector('[data-testid="sample"]')&&!document.querySelector('[data-testid="sample"]').disabled&&parseFloat(getComputedStyle(document.body).fontSize)===17`,
  );
  await page(
    `document.querySelector('[aria-label="에디터 환경설정"]').click()`,
  );
  await until(`document.querySelector('[data-testid="editor-dialog"]').open`);
  await setTextSize(13);
  await until(`parseFloat(getComputedStyle(document.body).fontSize)===13`);
  await click("작업으로 돌아가기");
  await until(`parseFloat(getComputedStyle(document.body).fontSize)===17`);
  await page(
    `document.querySelector('[aria-label="에디터 환경설정"]').click()`,
  );
  await until(`document.querySelector('[data-testid="editor-dialog"]').open`);
  await click("기본값");
  await click("환경설정 저장");
  await until(
    `!document.querySelector('[data-testid="editor-dialog"]').open&&parseFloat(getComputedStyle(document.body).fontSize)===15`,
  );
  await click("빈 스테이지 추가");
  await until(`!!document.querySelector('svg.editable-board')`);
  await click("검증 예제로 시작");
  await until(`document.querySelectorAll('svg.editable-board>g').length===6`);
  await analyze();
  await save();
  const before = await store.load();
  assert.equal(before.stages.at(-1).candidates[0].versions.length, 1);
  const short = structuredClone(
    before.stages.at(-1).candidates[0].versions[0].draft.stage,
  );
  short.arrows[0].cells = [short.arrows[0].head_cell];
  const forced = await page(
    `window.arrowEditor.core({operation:'validate_stage',stage:${JSON.stringify(short)},stage_contract:'runtime_v1'})`,
  );
  assert.equal(
    forced.value.validation.valid,
    false,
    "renderer cannot bypass authoring minimum by claiming legacy contract",
  );
  assert.ok(
    before.stages
      .at(-1)
      .candidates[0].versions[0].draft.stage.arrows.every(
        (a) => a.cells.length >= 2,
      ),
  );
  await click("기본 조작");
  await drag([11, 8], [11, 8]);
  assert.equal(
    await page(`document.querySelectorAll('svg.editable-board>g').length`),
    6,
    "one-cell gesture is not a new arrow",
  );
  assert.equal(
    await page(`document.querySelector('main').dataset.dirty`),
    "false",
    "cancelled one-cell gesture adds no dirty state/history",
  );
  await drag([11, 8], [10, 8]);
  assert.equal(
    await page(`document.querySelectorAll('svg.editable-board>g').length`),
    7,
    "trusted mouse drag adds an arrow",
  );
  const selectedBefore = await page(
    `document.querySelector('main').dataset.selectedArrow`,
  );
  await page(`document.querySelector('.stage-row.current').click()`);
  assert.equal(
    await page(`document.querySelectorAll('dialog[open]').length`),
    0,
    "same-stage click is not navigation",
  );
  assert.equal(
    await page(`document.querySelector('main').dataset.selectedArrow`),
    selectedBefore,
    "same-stage click preserves current arrow",
  );
  assert.equal(
    await page(`document.querySelector('main').dataset.dirty`),
    "true",
  );
  await page(`document.querySelector('.stage-row:not(.current)').click()`);
  await until(`document.querySelectorAll('dialog[open]').length===1`);
  await click("취소");
  assert.equal(
    await page(`document.querySelector('main').dataset.selectedArrow`),
    selectedBefore,
    "other-stage navigation still guards dirty edits",
  );
  assert.equal(
    await page(
      `document.querySelectorAll('.arrow-inspector input[type="number"]').length`,
    ),
    0,
    "unsafe coordinate editor was removed",
  );
  assert.ok(
    (
      await page(
        `document.querySelector('[data-testid="arrow-direction"]').textContent`,
      )
    ).includes("오른쪽"),
  );
  await click("↶ 실행 취소");
  assert.equal(
    await page(`document.querySelectorAll('svg.editable-board>g').length`),
    6,
  );
  await click("↷ 다시 실행");
  assert.equal(
    await page(`document.querySelectorAll('svg.editable-board>g').length`),
    7,
  );
  await click("기본 조작");
  await wholeMove([11, 8], [11, 7]);
  await until(
    `document.querySelector('main').dataset.coreBusy==='false'&&document.querySelector('.arrow-inspector').textContent.includes('머리 11, 7')`,
  );
  assert.ok(
    (
      await page(
        `document.querySelector('[data-testid="arrow-direction"]').textContent`,
      )
    ).includes("오른쪽"),
  );
  await click("↶ 실행 취소");
  await until(
    `document.querySelector('.arrow-inspector').textContent.includes('머리 11, 8')`,
  );
  await click("↷ 다시 실행");
  await until(
    `document.querySelector('.arrow-inspector').textContent.includes('머리 11, 7')`,
  );
  await click("↶ 실행 취소");
  await wholeMove([8, 5], [6, 5]);
  await until(
    `document.querySelector('main').dataset.coreBusy==='false'&&document.querySelector('[role="alert"]')?.textContent.includes('배치를 적용하지')`,
  );
  assert.ok(
    (
      await page(`document.querySelector('.arrow-inspector').textContent`)
    ).includes("머리 8, 5"),
    "collision keeps original arrow position",
  );
  await page(`document.querySelector('.notice.error button').click()`);
  await click("영역");
  await drag([3, 4], [9, 8]);
  await save();
  let saved = await store.load(),
    entry = saved.stages.at(-1),
    candidate = entry.candidates[0];
  assert.equal(
    candidate.versions.length,
    2,
    "same candidate accumulates versions",
  );
  let draft = candidate.versions.at(-1).draft;
  const arrow = draft.stage.arrows.find((a) => a.id.startsWith("ARROW-"));
  assert.deepEqual(arrow.cells, [
    [11, 8],
    [10, 8],
  ]);
  assert.equal(arrow.direction, "RIGHT");
  assert.equal(draft.regions[0].cells.length, 35);
  await click("새 후보로 저장");
  await until(`!document.body.innerText.includes('저장 중…')`);
  await store.queue;
  saved = await store.load();
  entry = saved.stages.at(-1);
  assert.equal(entry.candidates.length, 2);
  assert.equal(entry.candidates[0].versions.length, 2);
  assert.equal(entry.candidates[1].versions.length, 1);
  await analyze();
  await click("흐름 분석");
  for (let i = 0; i < 3; i++) {
    await click("다음 화살 제거");
    await until(
      `document.querySelector('main').dataset.coreBusy==='false'&&document.querySelector('main').dataset.playbackStep==='${i + 1}'`,
    );
  }
  assert.ok((await page(`document.body.innerText`)).includes("3개 제거"));
  assert.equal(
    (await store.load()).stages.at(-1).candidates[1].versions[0].draft.stage
      .arrows.length,
    7,
    "playback never edits saved geometry",
  );
  assert.equal(await page(`typeof window.require`), "undefined");
  assert.equal(await page(`typeof window.process`), "undefined");
  await click("원본으로");
  await click("맵 작업");
  assert.equal(
    await page(`document.querySelector('main').dataset.coreBusy`),
    "false",
  );
  assert.equal(
    await page(`document.querySelector('main').dataset.analysis`),
    "solved",
  );
  assert.equal(
    await page(
      `document.querySelector('[data-testid="arrow-count"]').textContent`,
    ),
    "7개",
  );
  assert.equal(
    await page(
      `document.querySelector('[data-testid="cell-coverage"]').textContent`,
    ),
    "19%",
  );
  assert.equal(
    await page(
      `document.querySelector('[data-testid="candidate-history"]').open`,
    ),
    false,
  );
  await page(
    `document.querySelector('[data-testid="candidate-history"] summary').click()`,
  );
  assert.equal(
    await page(
      `document.querySelector('[data-testid="candidate-history"]').open`,
    ),
    true,
  );
  assert.equal(
    await page(`document.querySelectorAll('.candidate-card').length`),
    2,
  );
  await page(
    `document.querySelector('[data-testid="candidate-history"] summary').click()`,
  );

  const layouts = [];
  // Collision rejection was asserted above; measure the normal workspace without its error banner.
  await page(`document.querySelector('.notice.error button')?.click()`);
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
    await page(
      `new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`,
    );
    const layout = await page(`(()=>{
      const svg=document.querySelector('svg.editable-board'), m=svg.getScreenCTM(), v=svg.viewBox.baseVal;
      const card=document.querySelector('.board-card').getBoundingClientRect();
      const inspector=document.querySelector('[data-testid="stage-inspector"]').getBoundingClientRect();
      const summary=document.querySelector('[data-testid="intent-summary"]').getBoundingClientRect();
      return {width:innerWidth,height:innerHeight,boardWidth:v.width*m.a,boardHeight:v.height*m.d,
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
      layout.boardHeight > (layout.height < 850 ? 300 : 600),
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
  const interactionChecks = await runBoardInteractions({
    window,
    store,
    directory,
    page,
    until,
    click,
    analyze,
  });
  await page(
    `document.querySelector('[aria-label="에디터 환경설정"]').click()`,
  );
  await until(`document.querySelector('[data-testid="editor-dialog"]').open`);
  await delay(300);
  await window.webContents
    .capturePage()
    .then((image) =>
      writeFile(path.join(directory, "preferences.png"), image.toPNG()),
    );
  await click("작업으로 돌아가기");
  await page(
    `new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`,
  );
  await delay(200);
  window.showInactive();
  await delay(500);
  await window.webContents
    .capturePage()
    .then((image) =>
      writeFile(path.join(directory, "smoke.png"), image.toPNG()),
    );
  return {
    directory,
    coreAnalysis: true,
    headFirstDrawing: true,
    regionDrawing: true,
    undoRedo: true,
    sameCandidateVersions: 2,
    explicitBranch: true,
    legalPlaybackSteps: 3,
    nodeIsolated: true,
    compactInspector: true,
    intentRegionDetails: true,
    fontPreferences: true,
    sameStageNoOp: true,
    minimumTwoCells: true,
    checkedWholeArrowMove: true,
    responsiveLayouts: layouts,
    interactionChecks,
  };
}
