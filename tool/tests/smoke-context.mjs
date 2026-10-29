export function createSmokeContext(window, store, directory) {
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
  const ready = () =>
    until(
      `!!document.querySelector('[data-testid="sample"]')&&!document.querySelector('[data-testid="sample"]').disabled`,
    );
  return {
    window,
    store,
    directory,
    page,
    delay,
    until,
    click,
    setTextSize,
    save,
    analyze,
    drag,
    wholeMove,
    ready,
  };
}
