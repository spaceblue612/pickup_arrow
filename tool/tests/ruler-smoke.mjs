import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";

export async function runRulers({ window, directory, page, until, click, drag, delay }) {
  window.show(); window.focus();
  await page(`document.querySelector('[aria-label="스테이지 추가"]').click()`);
  await until(`!!document.querySelector('svg.editable-board')`);
  await click("화살 배치");
  await click("기본 조작");
  assert.equal(await page(`document.querySelectorAll('.board-ruler-columns button').length`), 12);
  assert.equal(await page(`document.querySelectorAll('.board-ruler-rows button').length`), 9);
  const dirtyBefore = await page(`document.querySelector('main').dataset.dirty`);
  await drag([6,3], [6,3]);
  assert.equal(await page(`document.querySelector('[aria-label="선택 좌표"]').textContent`), "열 6 · 행 3");
  assert.equal(await page(`document.querySelector('.board-ruler-columns .active').textContent`), "6");
  assert.equal(await page(`document.querySelector('.board-ruler-rows .active').textContent`), "3");
  await page(`document.querySelector('.board-ruler-columns [aria-label="열 8"]').click();document.querySelector('.board-ruler-rows [aria-label="행 5"]').click()`);
  await until(`document.querySelector('[aria-label="선택 좌표"]').textContent==='열 8 · 행 5'`);
  assert.equal(await page(`document.querySelector('main').dataset.dirty`), dirtyBefore);
  assert.equal(await page(`document.querySelectorAll('svg [data-arrow-id]').length`), 0);
  async function aligned() {
    const errors = await page(`(()=>{
      const svg=document.querySelector('svg.editable-board'), m=svg.getScreenCTM();
      return [...document.querySelectorAll('.board-ruler button')].map(button=>{
        const value=Number(button.textContent), horizontal=button.parentElement.classList.contains('board-ruler-columns');
        const p=new DOMPoint((value-.5)*40,(value-.5)*40).matrixTransform(m), r=button.getBoundingClientRect();
        return Math.abs(horizontal ? r.left+r.width/2-p.x : r.top+r.height/2-p.y);
      });
    })()`);
    assert.ok(errors.length > 0 && errors.every(error => error < 1), "ruler labels align with grid centers");
  }
  await aligned();
  await writeFile(path.join(directory, "board-rulers.png"), (await window.webContents.capturePage()).toPNG());
  const camera = () => page(`document.querySelector('.interactive-board').dataset.camera`);
  const beforeZoom = await camera();
  const center = await page(`(()=>{const r=document.querySelector('svg.editable-board').getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2}})()`);
  await page(`document.querySelector('svg.editable-board').dispatchEvent(new WheelEvent('wheel',{clientX:${center.x},clientY:${center.y},deltaY:-180,bubbles:true,cancelable:true}))`);
  await delay(150);
  assert.notEqual(await camera(), beforeZoom, "zoom changes the camera");
  await aligned();
  const beforePan = await camera();
  const start = { x: Math.round(center.x), y: Math.round(center.y) };
  window.webContents.sendInputEvent({ type: "mouseDown", ...start, button: "middle", clickCount: 1 });
  await delay(50);
  window.webContents.sendInputEvent({ type: "mouseMove", x: start.x + 70, y: start.y + 45, modifiers: ["middleButtonDown"] });
  window.webContents.sendInputEvent({ type: "mouseUp", x: start.x + 70, y: start.y + 45, button: "middle" });
  await delay(150);
  assert.notEqual(await camera(), beforePan, "pan changes the camera");
  await aligned();
  await click("화면 맞춤");
  await aligned();
  return { rulerSelection: true, coordinates: true, noDraftChanges: true, zoomPanAlignment: true };
}
