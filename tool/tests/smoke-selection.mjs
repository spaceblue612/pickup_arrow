export const SMOKE_SUITES = Object.freeze([
  "startup",
  "preferences",
  "workflow",
  "layout",
  "placement",
  "editing",
]);

export function selectSmokeSuites(value = "startup") {
  if (value === "all") return [...SMOKE_SUITES];
  const selected = [...new Set(value.split(","))];
  if (
    !selected.length ||
    selected.some((name) => !SMOKE_SUITES.includes(name))
  ) {
    throw Error(
      `알 수 없는 화면 테스트: ${value}. 사용 가능: ${SMOKE_SUITES.join(", ")}, all`,
    );
  }
  return selected;
}
