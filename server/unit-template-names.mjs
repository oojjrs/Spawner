const UNIT_TEMPLATE_ROLES = [
  [["construction"], "개척자"],
  [["regeneration", "guard"], "수호 치유사"],
  [["regeneration"], "치유사"],
  [["guard"], "수호자"],
  [["blade", "piercing"], "돌격병"],
  [["blade", "strength"], "벌목꾼"],
  [["piercing", "strength"], "광부"],
  [["blade"], "전사"],
  [["piercing"], "관통병"],
  [["excavation"], "굴착꾼"],
  [["butchery"], "회수꾼"],
  [["strength"], "수송꾼"],
  [["carapace"], "파수꾼"],
  [["antenna"], "정찰병"],
  [["feet"], "척후병"],
  [[], "일꾼"]
];

const UNIT_TEMPLATE_MODIFIERS = [["feet", "날쌘"], ["antenna", "눈밝은"], ["carapace", "튼튼한"], ["lifespan", "장수"]];

export function suggestTemplateName(slots, templates) {
  const [required, role] = UNIT_TEMPLATE_ROLES.find(([keys]) => keys.every(key => slots.includes(key)));
  const modifier = UNIT_TEMPLATE_MODIFIERS.find(([key]) => slots.includes(key) && !required.includes(key));
  const base = (modifier ? modifier[1] + " " : "") + role;
  const names = new Set(templates.map(template => template.name));
  let name = base, number = 2;
  while (names.has(name)) name = base + " " + number++;
  return name;
}
