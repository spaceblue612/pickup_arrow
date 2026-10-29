import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export async function runPreferences({
  window,
  directory,
  page,
  until,
  click,
  setTextSize,
}) {
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
  await page(
    `document.querySelector('[aria-label="에디터 환경설정"]').click()`,
  );
  await until(`document.querySelector('[data-testid="editor-dialog"]').open`);
  await writeFile(
    path.join(directory, "preferences.png"),
    (await window.webContents.capturePage()).toPNG(),
  );
  await click("작업으로 돌아가기");
  return { fontPreferences: true, persistedSettings: true };
}
