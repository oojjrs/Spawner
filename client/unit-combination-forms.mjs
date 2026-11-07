// Authored whole-body combinations. Other visible traits keep the existing
// dominant-form policy; this catalog never alters simulation attributes.
export const UNIT_COMBINATION_FORMS = Object.freeze([
  { key: "blade-carapace", label: "칼날+갑각", mask: 3, attributes: { blade: 1, carapace: 1 } },
  { key: "secretion-carapace", label: "분비+갑각", mask: 18, attributes: { secretion: 1, carapace: 1 } },
  { key: "blade-secretion", label: "칼날+분비", mask: 17, attributes: { blade: 1, secretion: 1 } },
  { key: "blade-secretion-carapace", label: "칼날+분비+갑각", mask: 19, attributes: { blade: 1, secretion: 1, carapace: 1 } },
].map(form => Object.freeze({ ...form, attributes: Object.freeze(form.attributes) })));

export const UNIT_COMBINATION_MASKS = Object.freeze(UNIT_COMBINATION_FORMS.map(form => form.mask));
