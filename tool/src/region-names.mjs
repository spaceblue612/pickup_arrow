export function nextRegionName(regions) {
  const used = new Set(regions.map(region => region.name));
  let number = Math.max(0, ...regions.map(region => Number(/^영역 (\d+)$/.exec(region.name)?.[1] ?? 0))) + 1;
  while (used.has(`영역 ${number}`)) number++;
  return `영역 ${number}`;
}

// Preserve IDs, geometry, and the first occurrence of each nonempty name.
export function repairRegions(regions) {
  const result = regions.filter(region => region.cells.length > 0).map(region => structuredClone(region));
  const seen = new Set();
  for (const region of result) {
    if (seen.has(region.name)) region.name = nextRegionName(result);
    seen.add(region.name);
  }
  return result;
}
