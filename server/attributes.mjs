export const ATTRIBUTES = [
  { key: "strength", name: "힘", color: "#e6a79c", effect: "운반량 +2개", description: "한 번에 운반할 수 있는 먹이의 양을 늘립니다.", bonus: 2, stat: "운반량", unit: "개" },
  { key: "feet", name: "이동", color: "#8cd2bb", effect: "이동 속도 +0.5칸/초", description: "탐색과 왕복 이동을 빠르게 합니다.", bonus: 0.5, stat: "이동 속도", unit: "칸/초" },
  { key: "antenna", name: "감각", color: "#b2bffa", effect: "시야 반경 +2칸", description: "군락과 공유하는 실제 시야를 넓힙니다.", bonus: 2, stat: "시야 반경", unit: "칸" },
  { key: "shell", name: "저항", color: "#a7cbd2", effect: "환경 피해 25% 감소", description: "환경 피해를 곱셈으로 줄입니다. 두 개 장착하면 43.75% 감소합니다.", bonus: 25, stat: "환경 피해 감소", unit: "%" }
];

export const ATTRIBUTE_COMBINATIONS = [
  { keys: ["strength", "strength"], name: "과적", description: "운반량 6개를 넘겨 최대 10개까지 적재합니다. 초과 적재 중 이동 속도는 20% 감소합니다." },
  { keys: ["strength", "feet"], name: "적재 가속", description: "적재율에 비례해 이동 속도가 최대 50% 증가합니다." },
  { keys: ["strength", "antenna"], name: "맥 짚기", description: "현장 준비 후 먹이 2개를 즉시 담습니다. 같은 먹이 더미에 개체별 30초 간격으로 발동합니다." },
  { keys: ["strength", "shell"], name: "충격 경화", description: "피격 직후 피해 4를 흡수하는 보호막이 4초간 생깁니다. 재사용 대기시간은 12초입니다." },
  { keys: ["feet", "feet"], name: "질주", description: "직선으로 4칸 이동하면 이동 속도가 75% 증가합니다. 정지하거나 방향을 바꾸면 해제됩니다." },
  { keys: ["feet", "antenna"], name: "탐색 파동", description: "8칸 이동할 때마다 1초간 시야 반경이 5칸에서 9칸으로 넓어집니다." },
  { keys: ["feet", "shell"], name: "위험 가속", description: "위험 지형 안에서 이동 속도가 3배가 됩니다. 위험 지형의 기본 감속은 함께 적용됩니다." },
  { keys: ["antenna", "antenna"], name: "미지 감지", description: "반경 18칸 안개 속 미확인 대상에 느낌표를 표시합니다. 정체와 수량은 실제 시야로 확인합니다." },
  { keys: ["antenna", "shell"], name: "위험 예감", description: "위험 지역 진입 시 1초간 환경 피해를 막습니다. 재사용 대기시간은 15초입니다." },
  { keys: ["shell", "shell"], name: "환경 적응", description: "같은 환경 위험에 1초 노출되면 해당 피해가 90% 추가 감소합니다. 위험을 벗어난 뒤 5초가 지나면 해제됩니다." }
];

export function attributeCounts(slots) {
  const counts = Object.fromEntries(ATTRIBUTES.map(attribute => [attribute.key, 0]));
  for (const slot of slots) {
    const key = slot === "arms" ? "strength" : slot;
    if (Object.hasOwn(counts, key)) counts[key] += 1;
  }
  return counts;
}

export function hasSynergy(counts, keys) {
  const required = attributeCounts(keys);
  return ATTRIBUTES.every(attribute => (counts[attribute.key] || 0) >= required[attribute.key]);
}

export function unitStats(attributes) {
  return {
    speed: 1 + attributes.feet * 0.5,
    capacity: 2 + attributes.strength * 2,
    vision: 3 + attributes.antenna * 2,
    attack: 1,
    health: 12,
    resistance: 0.75 ** attributes.shell
  };
}

export function birthCost(template) {
  return [3, 5, 8][template.slots.length] ?? Infinity;
}
