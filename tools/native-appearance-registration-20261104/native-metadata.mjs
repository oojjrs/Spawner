import fs from 'node:fs';
import { UNIT_ANIMATIONS } from '../../client/unit-animation.mjs';
import { AGENT_DEATH_ANIMATIONS } from '../../client/agent-death.mjs';
import { SPORE_BIRTH_ANIMATION, PEBBLE_BIRTH_ANIMATION, SPRING_BIRTH_ANIMATION } from '../../client/birth.mjs';
import { UNIT_DISPLAY_SIZES } from '../../client/unit-size.mjs';
import { imageScale } from '../../client/image-geometry.mjs';

const births = { spore: SPORE_BIRTH_ANIMATION, pebble: PEBBLE_BIRTH_ANIMATION, spring: SPRING_BIRTH_ANIMATION };
const records = Object.fromEntries(['bean', 'spore', 'pebble', 'spring'].map(tribe => {
  const source = JSON.parse(fs.readFileSync(`DesignAssets/Animations/UnitAppearanceV1/${tribe}/00/source.json`));
  const actions = { ...UNIT_ANIMATIONS[tribe], death: AGENT_DEATH_ANIMATIONS[tribe] };
  const birth = births[tribe];
  return [tribe, { source, displaySize: UNIT_DISPLAY_SIZES[tribe], actions, birth: birth ? { ...birth, imageScale: imageScale(birth.image) } : null }];
}));
console.log(JSON.stringify(records));
