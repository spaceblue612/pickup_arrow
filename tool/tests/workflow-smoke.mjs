import assert from "node:assert/strict";

export async function runWorkflow({
  window,
  store,
  page,
  until,
  click,
  save,
  analyze,
  drag,
  wholeMove,
}) {
  await page(`document.querySelector('[aria-label="스테이지 추가"]').click()`);
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
  await page(`document.querySelector('[data-testid=notice-dismiss]').click()`);
  await click("영역 관리");
  await drag([3, 4], [9, 8]);
  await click("화살 배치");
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

  return {
    coreAnalysis: true,
    drawing: true,
    undoRedo: true,
    candidateVersions: true,
    explicitBranch: true,
    legalPlaybackSteps: 3,
    sameStageNoOp: true,
  };
}
