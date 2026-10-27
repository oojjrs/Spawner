export function createCheats(document, onCommand) {
  const option = document.createElement("label");
  option.className = "room-cheats-option";
  const checkbox = document.createElement("input");
  checkbox.id = "room-cheats";
  checkbox.type = "checkbox";
  option.append(checkbox, "치트 활성화");
  document.querySelector('#welcome-form button[type="submit"]').before(option);

  const panel = document.createElement("aside");
  panel.id = "cheat-panel";
  panel.className = "cheat-panel";
  panel.setAttribute("aria-labelledby", "cheat-title");
  panel.hidden = true;
  const title = document.createElement("h2");
  title.id = "cheat-title";
  title.textContent = "치트";
  const extinction = document.createElement("button");
  extinction.id = "cheat-extinction";
  extinction.className = "secondary-action";
  extinction.type = "button";
  extinction.textContent = "종족 멸망";
  extinction.title = "내 종족의 모든 유닛을 사망시키고 진화 포인트를 0으로 만들어 멸망시킵니다.";
  extinction.disabled = true;
  extinction.addEventListener("click", () => onCommand({ type: "cheat-extinction" }));
  panel.append(title, extinction);
  document.querySelector(".stage").append(panel);
  return {
    get enabled() { return checkbox.checked; },
    update(enabled, disabled) {
      panel.hidden = !enabled;
      extinction.disabled = disabled;
    }
  };
}
