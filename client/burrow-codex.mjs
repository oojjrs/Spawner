import { BURROW_TYPES } from "../server/burrows.mjs";

export const BURROW_CODEX = Object.freeze(Object.entries(BURROW_TYPES).map(([key, value]) => Object.freeze({
  ...value, key, name: key === "small" ? "작은 굴" : "큰 굴",
  description: "가시등 딱정벌레가 주기적으로 나타나는 굴입니다. 굴이 파괴되면 추가 등장이 멈춥니다."
})));
