const root = "DesignAssets/Attributes/ExcavationV2/";
export const EXCAVATION_ASSETS = Object.freeze([root + "rig.json",
  ...["bean", "spore", "pebble", "spring"].map(tribe => root + "Parts/" + tribe + ".png")]);

export function createExcavationArt(assetSource, loadImage) {
  const images = new Map();
  let data = null, pending = null;

  function prepare() {
    if (!pending) pending = (async () => {
      const response = await fetch(assetSource(root + "rig.json"));
      if (!response.ok) throw new Error("굴착 외형을 불러오지 못했습니다.");
      const rig = await response.json();
      await Promise.all(Object.entries(rig.parts).map(async ([tribe, part]) => {
        images.set(tribe, await loadImage(assetSource(part.image)));
      }));
      data = rig;
    })().catch(error => { pending = null; throw error; });
    return pending;
  }

  function draw(context, tribe, guides) {
    const part = data?.parts[tribe], image = images.get(tribe);
    if (!part || !image || !guides) return false;
    const [a, b, c] = [part.guides.left, part.guides.right, part.guides.bottom];
    const [p, q, r] = [guides.left, guides.right, guides.bottom];
    if (![p, q, r].every(point => point?.every(Number.isFinite))) return false;
    if (part.deformation === "rigid") {
      const source = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], target = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
      const sourceAngle = Math.atan2(b[1] - a[1], b[0] - a[0]), targetAngle = Math.atan2(q[1] - p[1], q[0] - p[0]);
      const sourceHeight = -(c[0] - source[0]) * Math.sin(sourceAngle) + (c[1] - source[1]) * Math.cos(sourceAngle);
      const targetHeight = -(r[0] - target[0]) * Math.sin(targetAngle) + (r[1] - target[1]) * Math.cos(targetAngle);
      const scale = Math.min(Math.hypot(q[0] - p[0], q[1] - p[1]) / Math.hypot(b[0] - a[0], b[1] - a[1]), Math.abs(targetHeight / sourceHeight));
      if (scale < .0001) return false;
      context.save(); context.translate(...target); context.rotate(targetAngle - sourceAngle); context.scale(scale, scale); context.translate(-source[0], -source[1]);
      context.drawImage(image, ...part.box); context.restore(); return true;
    }
    const determinant = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
    const xx = ((q[0] - p[0]) * (c[1] - a[1]) - (r[0] - p[0]) * (b[1] - a[1])) / determinant;
    const xy = ((r[0] - p[0]) * (b[0] - a[0]) - (q[0] - p[0]) * (c[0] - a[0])) / determinant;
    const yx = ((q[1] - p[1]) * (c[1] - a[1]) - (r[1] - p[1]) * (b[1] - a[1])) / determinant;
    const yy = ((r[1] - p[1]) * (b[0] - a[0]) - (q[1] - p[1]) * (c[0] - a[0])) / determinant;
    if (Math.abs(xx * yy - xy * yx) < .000001) return false;
    context.save();
    context.transform(xx, yx, xy, yy, p[0] - xx * a[0] - xy * a[1], p[1] - yx * a[0] - yy * a[1]);
    context.drawImage(image, ...part.box);
    context.restore();
    return true;
  }

  function body(context, tribe, box, angle) {
    const part = data?.parts[tribe];
    if (!part || box[2] <= 0 || box[3] <= 0) return false;
    const reference = part.body, pivot = [box[0] + box[2] / 2, box[1] + box[3]];
    const point = value => {
      const x = ((value[0] - reference[0]) / reference[2] - .5) * box[2];
      const y = ((value[1] - reference[1]) / reference[3] - 1) * box[3];
      return [pivot[0] + x * Math.cos(angle) - y * Math.sin(angle),
        pivot[1] + x * Math.sin(angle) + y * Math.cos(angle)];
    };
    return draw(context, tribe, Object.fromEntries(Object.entries(part.guides).map(([key, value]) => [key, point(value)])));
  }

  function sprout(context, attributes, box) {
    if (!attributes.excavation || !data) return false;
    const reference = data.sprout.normal;
    const point = value => [box[0] + value[0] / reference.size[0] * box[2],
      box[1] + value[1] / reference.size[1] * box[3]];
    return draw(context, "bean", Object.fromEntries(Object.entries(reference.guides).map(([key, value]) => [key, point(value)])));
  }

  return { prepare, draw, body, sprout };
}
