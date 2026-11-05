// Review-only visual clock. Never writes agent/game state or changes damage,
// attack schedules, movement, stagger or stun. The caller supplies real hit times.
export const HURT_HOLD_SECONDS = .5;
export const HURT_TOTAL_SECONDS = .88;
const KEYS = [[.5,1],[.66,0],[.72,-.22],[.8,.07],[.88,0]];
const smooth = t => t*t*(3-2*t);
export function sampleHurtHold(time, hits) {
  let latest = null;
  for (const hit of hits) if (Number.isFinite(hit.at) && hit.at <= time && (!latest || hit.at >= latest.at)) latest = hit;
  if (!latest) return {age:null,amount:0,phase:'idle',holdElapsed:0,direction:1,hitAt:null};
  const age = time-latest.at, direction = latest.direction < 0 ? -1 : 1;
  if (age >= HURT_TOTAL_SECONDS) return {age,amount:0,phase:'idle',holdElapsed:HURT_HOLD_SECONDS,direction,hitAt:latest.at};
  if (age <= HURT_HOLD_SECONDS) return {age,amount:1,phase:'hold',holdElapsed:age,direction,hitAt:latest.at};
  for (let i=1;i<KEYS.length;i++) if (age<=KEYS[i][0]) {
    const [a,x]=KEYS[i-1],[b,y]=KEYS[i],t=smooth((age-a)/(b-a));
    return {age,amount:x+(y-x)*t,phase:'recovery',holdElapsed:HURT_HOLD_SECONDS,direction,hitAt:latest.at};
  }
  return {age,amount:0,phase:'idle',holdElapsed:HURT_HOLD_SECONDS,direction,hitAt:latest.at};
}
