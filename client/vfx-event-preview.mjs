import { combatVfxAt } from "./combat-vfx-events.mjs";
import { unitRangedPose, unitRangedProjectile, unitRangedDisplaySize } from "./unit-ranged.mjs";

export function rangedReviewState(data, time) {
  const state = combatVfxAt(data.events, time), launch = data.events.find(event => event.kind === "shoot");
  const impact = data.events.find(event => event.projectileId === launch?.projectileId && event.kind === "hit");
  return { ...state, phase: time < launch.at ? "발사 준비" : time < impact.at ? "비행 중" : "명중 판정",
    sourcePose: unitRangedPose(data.source, time), targetPose: unitRangedPose(data.target, time),
    health: data.target.health - (time >= impact.at ? impact.amount : 0), launch, impact };
}

function attach(data) {
  const canvas = document.getElementById("vfx-ranged-scene");
  if (!canvas) return;
  const images = new Map(), $ = id => document.getElementById(id), reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let ready = false, playing = !reduced, time = 0, previous = null;
  const sources = [data.background, data.sourceForm.idle.image, data.sourceForm.animation.image,
    data.targetForm.idle.image, data.sourceForm.projectile.image];
  Promise.all([...new Set(sources)].map(async source => {
    const image = new Image(); image.src = globalThis.SpawnerAssets?.source(source) || source;
    await image.decode(); images.set(source, image);
  })).then(() => { ready = true; render(); }).catch(() => {
    playing = false; sync(); $("vfx-ranged-status").textContent = "원본 원거리 장면을 불러오지 못했습니다.";
  });
  function sync() { $("vfx-ranged-play").textContent = playing ? "일시정지" : "재생"; }
  function body(context, agent, pose, x, floor, world, mirror) {
    const clip = pose.animation, scale = unitRangedDisplaySize(agent) / clip.frameSize * world / 100;
    context.save(); context.translate(x, floor); context.scale(mirror ? -1 : 1, 1);
    context.drawImage(images.get(clip.image), pose.frame % clip.columns * clip.frameSize,
      Math.floor(pose.frame / clip.columns) * clip.frameSize, clip.frameSize, clip.frameSize,
      -clip.pivotX * scale, -clip.pivotY * scale, clip.frameSize * scale, clip.frameSize * scale);
    context.restore();
  }
  function render() {
    if (!ready) return;
    const context = canvas.getContext("2d"), box = canvas.getBoundingClientRect(), ratio = Math.min(devicePixelRatio || 1, 2);
    const width = box.width, height = box.height;
    if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
      canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0); context.imageSmoothingEnabled = true; context.imageSmoothingQuality = "high";
    const background = images.get(data.background), scale = Math.max(width / background.width, height / background.height);
    context.drawImage(background, (width - background.width * scale) / 2, (height - background.height * scale) / 2,
      background.width * scale, background.height * scale);
    const scene = rangedReviewState(data, time), sourceX = width * .18, targetX = width * .82,
      floor = height * .82, world = (targetX - sourceX) / 2;
    body(context, data.source, scene.sourcePose, sourceX, floor, world, false);
    body(context, data.target, scene.targetPose, targetX, floor, world, true);
    for (const flight of scene.projectiles) {
      const sprite = unitRangedProjectile(data.source), size = sprite.sourceScale * world / 100;
      const startX = sourceX + (sprite.outletX - 256) * size, startY = floor + (sprite.outletY - 448) * size;
      const endY = floor - height * .04;
      const x = startX + (targetX - startX) * flight.progress, y = startY + (endY - startY) * flight.progress;
      context.save(); context.translate(x, y); context.rotate(Math.atan2(endY - startY, targetX - startX));
      context.drawImage(images.get(sprite.image), -sprite.width * size / 2, -sprite.height * size / 2, sprite.width * size, sprite.height * size);
      context.restore();
    }
    context.textAlign = "center"; context.font = '600 12px system-ui'; context.fillStyle = "#edf2db";
    context.fillText("새싹콩", sourceX, floor + 23); context.fillText("포자버섯", targetX, floor + 23);
    context.fillStyle = "#24382a"; context.fillRect(targetX - 28, floor + 33, 56, 4);
    context.fillStyle = "#b6e294"; context.fillRect(targetX - 28, floor + 33, 56 * scene.health / data.target.stats.health, 4);
    const impact = scene.active.find(cue => cue.channel === "impact");
    if (impact) { context.fillStyle = "#f4e0aa"; context.fillText("−" + impact.amount.toFixed(1), targetX, floor - world * .48); }
    $("vfx-ranged-time").value = String(Math.round(time * 1000));
    $("vfx-ranged-time-value").textContent = Math.round(time * 1000) + "ms";
    $("vfx-ranged-status").textContent = scene.phase + " · 대상 HP " + scene.health.toFixed(1) + " / " + data.target.stats.health +
      " · 발사 " + Math.round(scene.launch.at * 1000) + "ms → 명중 " + Math.round(scene.impact.at * 1000) + "ms";
  }
  $("vfx-ranged-play").addEventListener("click", () => { playing = !playing; previous = null; sync(); });
  $("vfx-ranged-replay").addEventListener("click", () => { time = 0; previous = null; playing = true; sync(); render(); });
  $("vfx-ranged-time").addEventListener("input", event => { time = Number(event.target.value) / 1000; playing = false; previous = null; sync(); render(); });
  new ResizeObserver(render).observe(canvas);
  document.addEventListener("visibilitychange", () => { previous = null; });
  function tick(now) {
    if (ready && playing && !document.hidden && previous !== null) {
      time = (time + Math.min(100, now - previous) / 1000 * Number($("vfx-ranged-speed").value)) % data.seconds; render();
    }
    previous = now; requestAnimationFrame(tick);
  }
  sync(); requestAnimationFrame(tick);
}

if (typeof document !== "undefined" && globalThis.SpawnerVfxEventPreviewData) attach(globalThis.SpawnerVfxEventPreviewData);
if (typeof globalThis !== "undefined") globalThis.SpawnerVfxEventPreview = Object.freeze({ rangedReviewState });
