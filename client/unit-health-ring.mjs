export function drawUnitHealthRing(context, health, maximum, x, y, radius, color) {
  if (!Number.isFinite(health) || !Number.isFinite(maximum) || maximum <= 0 || health <= 0 || !Number.isFinite(radius) || radius <= 0) return false;
  const ratio = Math.max(0, Math.min(1, health / maximum)), depth = radius * .327;
  const thickness = Math.max(1, Math.min(6, radius * .064));
  context.save(); context.lineCap = "round";
  context.lineWidth = thickness + 2; context.strokeStyle = "#111b17e8";
  context.beginPath(); context.ellipse(x, y, radius, depth, 0, 0, Math.PI * 2); context.stroke();
  context.lineWidth = thickness; context.strokeStyle = "#485650";
  context.beginPath(); context.ellipse(x, y, radius, depth, 0, 0, Math.PI * 2); context.stroke();
  context.strokeStyle = color;
  context.beginPath(); context.ellipse(x, y, radius, depth, 0, Math.PI / 2 - Math.PI * ratio, Math.PI / 2 + Math.PI * ratio); context.stroke();
  context.restore(); return true;
}
