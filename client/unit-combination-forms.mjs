// Authored whole-body combinations, using the current four-organ selection.
// This catalogue never alters simulation attributes or DNA.
export const UNIT_COMBINATION_FORMS = Object.freeze([
  { key: "blade-carapace", label: "칼날+갑각", mask: 3, attributes: { blade: 1, carapace: 1 } },
  { key: "secretion-carapace", label: "분비+갑각", mask: 18, attributes: { secretion: 1, carapace: 1 } },
  { key: "blade-secretion", label: "칼날+분비", mask: 17, attributes: { blade: 1, secretion: 1 } },
  { key: "blade-secretion-carapace", label: "칼날+분비+갑각", mask: 19, attributes: { blade: 1, secretion: 1, carapace: 1 } },
  { key: "blade-antenna", label: "칼날+안테나", mask: 5, attributes: { blade: 1, antenna: 1 } },
  { key: "secretion-antenna", label: "분비+안테나", mask: 20, attributes: { secretion: 1, antenna: 1 } },
  { key: "carapace-antenna", label: "갑각+안테나", mask: 6, attributes: { carapace: 1, antenna: 1 } },
  { key: "blade-secretion-antenna", label: "칼날+분비+안테나", mask: 21, attributes: { blade: 1, secretion: 1, antenna: 1 } },
  { key: "blade-carapace-antenna", label: "칼날+갑각+안테나", mask: 7, attributes: { blade: 1, carapace: 1, antenna: 1 } },
  { key: "secretion-carapace-antenna", label: "분비+갑각+안테나", mask: 22, attributes: { secretion: 1, carapace: 1, antenna: 1 } },
  { key: "blade-secretion-carapace-antenna", label: "칼날+분비+갑각+안테나", mask: 23, attributes: { blade: 1, secretion: 1, carapace: 1, antenna: 1 } },
].map(form => Object.freeze({ ...form, attributes: Object.freeze(form.attributes) })));

export const UNIT_COMBINATION_MASKS = Object.freeze(UNIT_COMBINATION_FORMS.map(form => form.mask));

export const ANTENNA_COMBINATION_FORMS = Object.freeze(UNIT_COMBINATION_FORMS.filter(form => form.attributes.antenna));
