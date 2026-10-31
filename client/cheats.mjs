import { PLAYER_TRIBES } from "../server/player-tribes.mjs";

export function createCheats(document, onCommand) {
  const panel = document.createElement("aside");
  panel.id = "cheat-panel";
  panel.className = "cheat-panel";
  panel.setAttribute("aria-labelledby", "cheat-title");
  panel.hidden = true;
  const title = document.createElement("h2");
  title.id = "cheat-title";
  const toggle = document.createElement("button");
  toggle.id = "cheat-toggle";
  toggle.className = "cheat-toggle";
  toggle.type = "button";
  toggle.textContent = "치트 ▾";
  toggle.title = "치트 접기";
  toggle.setAttribute("aria-expanded", "true");
  toggle.setAttribute("aria-controls", "cheat-actions");
  title.append(toggle);
  const actions = document.createElement("div");
  actions.id = "cheat-actions";
  actions.className = "cheat-actions";
  toggle.addEventListener("click", () => {
    actions.hidden = !actions.hidden;
    toggle.textContent = actions.hidden ? "치트 ▸" : "치트 ▾";
    toggle.title = actions.hidden ? "치트 펼치기" : "치트 접기";
    toggle.setAttribute("aria-expanded", String(!actions.hidden));
  });
  const buttons = [
    ["cheat-evolution-points", "진화 +1만", "보유 한도를 넘어 진화 포인트를 10,000점 지급합니다."],
    ["cheat-resources", "재료 +100", "모든 종류의 재료를 창고에 100개씩 지급합니다."],
    ["cheat-upgrade", "둥지 +1", "진화 포인트를 사용하지 않고 둥지를 한 단계 성장시킵니다."],
    ["cheat-heal", "전체 회복", "살아 있는 내 유닛과 둥지의 체력을 모두 회복합니다."],
    ["cheat-extinction", "멸망", "내 종족의 모든 유닛을 사망시키고 진화 포인트를 0으로 만들어 멸망시킵니다."]
  ].map(([type, label, help]) => {
    const button = document.createElement("button");
    button.id = type;
    button.className = "secondary-action";
    button.type = "button";
    button.textContent = label;
    button.title = help;
    button.disabled = true;
    button.addEventListener("click", () => onCommand({ type }));
    return button;
  });
  const tribes = document.createElement("fieldset");
  tribes.id = "cheat-tribes";
  const legend = document.createElement("legend");
  legend.textContent = "종족 전환";
  tribes.append(legend);
  const tribeButtons = PLAYER_TRIBES.map(tribe => {
    const button = document.createElement("button");
    button.id = "cheat-tribe-" + tribe.key;
    button.className = "secondary-action";
    button.type = "button";
    button.textContent = tribe.name;
    button.title = tribe.name + " 군락의 진행 상태를 유지하며 조종권을 옮깁니다.";
    button.disabled = true;
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", () => onCommand({ type: "cheat-switch-tribe", tribe: tribe.key }, true));
    tribes.append(button);
    return { tribe: tribe.key, button };
  });
  actions.append(...buttons, tribes);
  panel.append(title, actions);
  document.querySelector(".stage").append(panel);
  return {
    update(enabled, disabled, tribe, ended) {
      panel.hidden = !enabled;
      for (const button of buttons) button.disabled = disabled || ended;
      for (const entry of tribeButtons) {
        const current = entry.tribe === tribe;
        entry.button.disabled = disabled || current;
        entry.button.setAttribute("aria-pressed", String(current));
      }
    }
  };
}
