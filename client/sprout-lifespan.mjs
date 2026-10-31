import { sproutRootGeometry } from "./sprout-roots.mjs";
import { constructionCorePose } from "./construction-rig.mjs";

const root = "DesignAssets/Tribes/sprout/Animations/Attributes/lifespan-v1/";
export const SPROUT_LIFESPAN_ASSETS = Object.freeze([root + "rig.json",
  ...["attack", "hurt", "death"].flatMap(action => [root + action + "-body.png", root + action + "-head.png"]),
  root + "body-half.png", root + "body-closed.png"]);

export function sproutLifespanBodyLayer(agent, time, reducedMotion) {
  const attributes = agent.appearanceAttributes || agent.attributes || {};
  if ((agent.tribe || "bean") !== "bean" || !attributes.lifespan || reducedMotion) return "body";
  const phase = ((time - (agent.animationStartedAt ?? agent.bornAt ?? 0)) % 6.4 + 6.4) % 6.4;
  return phase >= 5.08 && phase < 5.22 ? "body-closed" : phase >= 5 && phase < 5.30 ? "body-half" : "body";
}

export function createSproutLifespan(assetSource, createSurface, loadImage) {
  let data = null, pending = null;
  const images = new Map(), frames = new Map();

  function prepare() {
    if (!pending) pending = (async () => {
      const response = await fetch(assetSource(root + "rig.json"));
      if (!response.ok) throw new Error("수명 외형을 불러오지 못했습니다.");
      const rig = await response.json();
      await Promise.all(Object.values(rig.actions).flatMap(action => [action.body, action.head]).map(async name => {
        images.set(name, await loadImage(root + name));
      }));
      data = rig;
    })().catch(error => { pending = null; throw error; });
    return pending;
  }

  function bodyLift(attributes) {
    if (!attributes.feet) return 0;
    const lift = Math.max(0, 426 - 512 * .94 + sproutRootGeometry(attributes.feet).height * .88);
    return attributes.construction ? Math.max(40, lift) : lift;
  }

  function antenna(context, attributes, parts, x, y, angle, scale) {
    const count = attributes.antenna, part = parts.get("antenna-" + (count === 1 ? 1 : 2));
    const width = (count === 1 ? 196 : 344 + (count - 2) * 16) * scale;
    const height = width * part.naturalHeight / part.naturalWidth;
    context.save(); context.translate(x, y); context.rotate(angle);
    context.drawImage(part, -width / 2, -height, width, height); context.restore();
  }

  function frame(attributes, action, index, parts, roots) {
    const sequence = data?.actions[action];
    if (!sequence || !attributes.lifespan) return null;
    index = Math.max(0, Math.min(sequence.tracks.length - 1, index));
    const key = [action, index, attributes.antenna || 0, attributes.strength || attributes.arms || 0,
      attributes.feet || 0, attributes.butchery || 0].join(":");
    if (frames.has(key)) return frames.get(key);
    const track = sequence.tracks[index], size = data.frameSize;
    const sprite = createSurface(size, size), context = sprite.getContext("2d");
    const sx = track.body[2] / 240, sy = track.body[3] / 302, center = track.body[0] + track.body[2] / 2;
    const lift = bodyLift(attributes) * sy;
    const drawLayer = name => context.drawImage(images.get(name), index % data.columns * size,
      Math.floor(index / data.columns) * size, size, size, -128, -128, 768, 768);
    const drawHead = () => {
      if (attributes.antenna) antenna(context, attributes, parts, track.head[0], track.head[1], track.head[2], 1);
      else drawLayer(sequence.head);
    };
    context.scale(.25, .25); context.translate(128, 128);
    if (attributes.feet) {
      context.save(); context.translate(center - 256 * sx, track.bottom - 460 * sy); context.scale(sx, sy);
      roots.drawRig(context, parts.get("root-rig"), attributes.feet, null,
        { rotation: 0, bob: 0, pivot: 460 - bodyLift(attributes) }, null); context.restore();
    }
    context.save(); context.translate(0, -lift);
    if (attributes.butchery) context.drawImage(parts.get("butchery"), center - 256 * sx,
      track.bottom - 460 * sy, 512 * sx, 512 * sy);
    if (!track.headFront) drawHead();
    context.save();
    if (attributes.feet) { context.beginPath(); context.rect(-128, -128, 768, track.bottom - 24 * sy + 128); context.clip(); }
    drawLayer(sequence.body); context.restore();
    const strength = attributes.strength || attributes.arms || 0;
    if (strength) {
      const width = (344 + (strength - 1) * 24) * .78 * sx, height = (142 + (strength - 1) * 12) * .78 * sy;
      context.drawImage(parts.get("strength-" + (strength === 1 ? 1 : 2)), center - width / 2, track.bottom - height, width, height);
    }
    if (track.headFront) drawHead();
    context.restore();
    const result = { sprite, scale: data.scale, animation: { frameSize: size, columns: 1,
      pivotX: data.pivotX, pivotY: data.pivotY, frameCount: sequence.tracks.length, durationsMs: sequence.durationsMs } };
    frames.set(key, result);
    if (frames.size > 192) frames.delete(frames.keys().next().value);
    return result;
  }

  function construction(base, attributes, parts, roots, unit, omitRoots) {
    const sprite = createSurface(512, 512), context = sprite.getContext("2d");
    const absorption = base.absorption || 0, pose = constructionCorePose("bean", unit.rig, absorption, 0);
    const [x, , width, originalHeight] = pose.body;
    const height = originalHeight * (1 + 99 / 225 * (1 - absorption)), top = 460 - height;
    const lift = bodyLift(attributes) * (1 - absorption);
    if (attributes.feet && !omitRoots) {
      const geometry = sproutRootGeometry(attributes.feet), rootTop = geometry.floor - geometry.height;
      context.save(); context.translate(256, rootTop - 100 * absorption);
      context.scale(1 - .75 * absorption, 1 - .45 * absorption); context.translate(-256, -rootTop);
      roots.drawRig(context, parts.get("root-rig"), attributes.feet, null,
        { rotation: 0, bob: 0, pivot: 460 - bodyLift(attributes) }, null); context.restore();
    }
    context.translate(0, -lift);
    if (attributes.butchery) {
      context.save(); context.translate(256, top + height * .6); context.scale(1 - absorption * .9, 1 - absorption * .9);
      context.drawImage(parts.get("butchery"), -256, -top - height * .6, 512, 512); context.restore();
    }
    const crownWidth = pose.crown[2], crownHeight = pose.crown[3];
    if (!attributes.antenna || absorption > .6) {
      const emerging = attributes.antenna ? Math.max(0, (absorption - .6) / .4) : 1;
      context.drawImage(unit.partsImage, ...unit.rig.parts.crown, 256 - crownWidth / 2,
        top + crownHeight * .18 - crownHeight * emerging, crownWidth, crownHeight);
    }
    if (attributes.antenna && absorption < 1) antenna(context, attributes, parts, 256,
      top + 16 + height * .35 * absorption, 0, 1 - absorption * .98);
    context.drawImage(unit.partsImage, ...unit.rig.parts.body, x, top, width, height);
    const eyeParts = pose.closed ? [unit.rig.parts.eyesClosedLeft, unit.rig.parts.eyesClosedRight] :
      [unit.rig.parts.eyesOpenLeft, unit.rig.parts.eyesOpenRight];
    const eyeWidth = (pose.closed ? 30 : 23) * pose.eyeScale;
    for (const [index, side] of [-1, 1].entries()) {
      const eye = eyeParts[index], eyeHeight = eyeWidth * eye[3] / eye[2];
      context.drawImage(unit.partsImage, ...eye, 256 + side * pose.eyeSpread - eyeWidth / 2,
        top + height * .53 - eyeHeight / 2, eyeWidth, eyeHeight);
    }
    const strength = attributes.strength || attributes.arms || 0;
    if (strength) {
      const armWidth = (344 + (strength - 1) * 24) * .78, armHeight = (142 + (strength - 1) * 12) * .78;
      const centerY = 460 - armHeight / 2 + (top + height * .6 - 460 + armHeight / 2) * absorption;
      context.drawImage(parts.get("strength-" + (strength === 1 ? 1 : 2)), 256 - armWidth / 2,
        centerY - armHeight / 2, armWidth, armHeight);
    }
    return sprite;
  }

  return { prepare, frame, construction };
}
