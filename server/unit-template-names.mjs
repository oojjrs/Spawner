const UNIT_TEMPLATE_ROLES = [
  [["blade", "piercing"], "돌격병"],
  [["blade", "strength"], "벌목꾼"],
  [["piercing", "strength"], "광부"],
  [["blade"], "전사"],
  [["piercing"], "관통병"],
  [["strength"], "수송꾼"],
  [["carapace"], "파수꾼"],
  [[], "일꾼"]
];

const UNIT_TEMPLATE_MODIFIERS = [["feet", "날쌘"], ["antenna", "눈밝은"], ["carapace", "튼튼한"]];

function isDefaultTemplateName(name, base) {
  return name === base || name.startsWith(base + " ") && /^(?:[2-9]|[1-9]\d+)$/.test(name.slice(base.length + 1));
}

export function isTemplateNameEdited(template) {
  if (typeof template?.nameEdited === "boolean") return template.nameEdited;
  return !!template?.name && !isDefaultTemplateName(template.name, suggestTemplateName(template.slots, []));
}

export function suggestTemplateName(slots, templates, templateId) {
  const [required, role] = UNIT_TEMPLATE_ROLES.find(([keys]) => keys.every(key => slots.includes(key)));
  const modifier = UNIT_TEMPLATE_MODIFIERS.find(([key]) => slots.includes(key) && !required.includes(key));
  const base = (modifier ? modifier[1] + " " : "") + role;
  const previous = templateId == null ? null : templates.find(template => template.id === templateId);
  if (previous && isDefaultTemplateName(previous.name, base)) return previous.name;
  const names = new Set(templates.filter(template => !previous || template.id !== previous.id).map(template => template.name));
  let name = base, number = 2;
  while (names.has(name)) name = base + " " + number++;
  return name;
}
