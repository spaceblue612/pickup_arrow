// Window preferences are separate from stages, candidates, and generation settings.
export function restoreWindowState(value, workAreas) {
  const valid = Boolean(value) && ['x', 'y', 'width', 'height'].every(key => Number.isSafeInteger(value[key])) && value.width > 0 && value.height > 0;
  const bounds = valid ? value : { x: 0, y: 0, width: 1680, height: 1080 };
  const intersection = area => Math.max(0, Math.min(bounds.x + bounds.width, area.x + area.width) - Math.max(bounds.x, area.x)) * Math.max(0, Math.min(bounds.y + bounds.height, area.y + area.height) - Math.max(bounds.y, area.y));
  const area = valid ? [...workAreas].sort((a, b) => intersection(b) - intersection(a))[0] : workAreas[0];
  const minWidth = Math.min(1100, area.width), minHeight = Math.min(740, area.height);
  const width = Math.min(area.width, Math.max(minWidth, bounds.width));
  const height = Math.min(area.height, Math.max(minHeight, bounds.height));
  return {
    x: valid ? Math.max(area.x, Math.min(bounds.x, area.x + area.width - width)) : area.x + Math.round((area.width - width) / 2),
    y: valid ? Math.max(area.y, Math.min(bounds.y, area.y + area.height - height)) : area.y + Math.round((area.height - height) / 2),
    width, height, minWidth, minHeight,
    maximized: valid && value.maximized === true,
  };
}
