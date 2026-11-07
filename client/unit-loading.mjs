export function drawUnitLoading(context, x, y, radius, time) {
  const angle = (globalThis.performance?.now() ?? Date.now()) / 250;
  context.save(); context.translate(x, y); context.lineWidth = Math.max(2, radius * .22);
  context.strokeStyle = "#17312588"; context.beginPath(); context.arc(0, 0, radius, 0, Math.PI * 2); context.stroke();
  context.strokeStyle = "#e5f5d9"; context.lineCap = "round"; context.beginPath(); context.arc(0, 0, radius, angle, angle + Math.PI * 1.4); context.stroke();
  context.restore();
}
