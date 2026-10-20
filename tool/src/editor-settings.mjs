import path from "node:path";
import { TEXT_SIZE } from "./text-size.mjs";

export function validSettings(value) {
  if (
    !value ||
    typeof value.godot !== "string" ||
    !value.godot.trim() ||
    value.godot.length > 4096 ||
    typeof value.project !== "string" ||
    !path.isAbsolute(value.project) ||
    !Number.isInteger(value.timeoutMs) ||
    value.timeoutMs < 1000 ||
    value.timeoutMs > 300000
  )
    throw new Error(
      "Godot 경로·프로젝트 절대 경로·제한 시간(1~300초)을 확인해 주세요.",
    );
  const textSizeOffset =
    value.textSizeOffset ?? TEXT_SIZE.default - TEXT_SIZE.base;
  if (
    !Number.isInteger(textSizeOffset) ||
    textSizeOffset < TEXT_SIZE.min - TEXT_SIZE.base ||
    textSizeOffset > TEXT_SIZE.max - TEXT_SIZE.base
  )
    throw new Error(
      `글자 크기는 ${TEXT_SIZE.min}~${TEXT_SIZE.max}px 범위로 설정해 주세요.`,
    );
  return {
    godot: value.godot,
    project: value.project,
    timeoutMs: value.timeoutMs,
    textSizeOffset,
  };
}
