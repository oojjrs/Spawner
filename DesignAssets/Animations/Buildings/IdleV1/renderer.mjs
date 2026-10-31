import { drawConstructionBed } from "../../../../client/construction-growth.mjs";

export function createBuildingIdleRig(sequence) {
  const flexible = sequence.tribe !== "pebble";
  const order = ["back", ...(!["evolution-lab", "watchpost"].includes(sequence.kind) ? ["feature"] : []),
    "left", "right", ...(["evolution-lab", "watchpost"].includes(sequence.kind) ? ["feature"] : []), "roof", "front"];
  const layers = order.filter(name => name !== "feature" || sequence.featureVisible !== false).map(name => {
    const layout = sequence.layout[name], [width, height] = layout.size;
    const x = layout.center[0] - width * layout.pivot[0], y = layout.center[1] - height * layout.pivot[1];
    const canopy = flexible && name === "roof";
    const suspended = flexible && name === "feature" && sequence.kind === "evolution-lab";
    const moving = canopy || suspended;
    const columns = canopy ? 16 : 1, rows = canopy ? 10 : 1;
    const vertices = [], triangles = [];
    for (let row = 0; row <= rows; row++) for (let column = 0; column <= columns; column++) {
      const u = column / columns, v = row / rows;
      const influence = suspended ? 1 : canopy ? Math.pow(Math.sin(Math.PI * u), .7) * Math.pow(1 - v, 1.35) : 0;
      vertices.push({ uv: [u, v], position: [x + u * width, y + v * height], weights: [1 - influence, influence] });
    }
    for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
      const a = row * (columns + 1) + column, b = a + 1, c = a + columns + 1, d = c + 1;
      triangles.push([a, b, c], [b, d, c]);
    }
    const spring = sequence.tribe === "spring", spore = sequence.tribe === "spore";
    return { name, source: sequence.parts[name], layout, vertices, triangles,
      bones: [{ name: "root", parent: null, bindPosition: [0, 0] },
        { name: name + "-bend", parent: "root", bindPosition: [layout.center[0], y + height],
          timeline: { rotation: moving ? suspended ? .045 : spore ? .018 : spring ? .040 : .032 : 0,
            x: canopy ? spring ? .035 : .016 : 0, y: moving ? suspended ? -.040 : spore ? -.033 : spring ? -.025 : -.017 : 0,
            phase: name === "feature" ? .15 : 0 } }],
      light: sequence.tribe === "pebble" && ["roof", "feature"].includes(name) ||
        name === "feature" && sequence.kind === "evolution-lab" || spring && name === "back" };
  });
  return { tribe: sequence.tribe, kind: sequence.kind, source: sequence.image, reference: sequence.completeImage,
    canvas: [432, 432], pivot: [216, 216], duration: 4.8, frameCount: 48, frameDuration: 100,
    fixed: ["bed", "back", "left", "right", "front"], layers };
}

function meshSurface() {
  const surface = document.createElement("canvas"); surface.width = surface.height = 432;
  const gl = surface.getContext("webgl2", { premultipliedAlpha: true, preserveDrawingBuffer: true, antialias: false });
  if (!gl) throw new Error("Building idle mesh rendering requires WebGL2");
  function shader(type, source) {
    const value = gl.createShader(type); gl.shaderSource(value, source); gl.compileShader(value);
    if (!gl.getShaderParameter(value, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(value));
    return value;
  }
  const program = gl.createProgram();
  gl.attachShader(program, shader(gl.VERTEX_SHADER, `#version 300 es
in vec2 position;
in vec2 uv;
out vec2 textureUv;
void main() { gl_Position = vec4(position.x / 216.0, -position.y / 216.0, 0.0, 1.0); textureUv = uv; }`));
  gl.attachShader(program, shader(gl.FRAGMENT_SHADER, `#version 300 es
precision highp float;
uniform sampler2D image;
in vec2 textureUv;
out vec4 color;
void main() { color = texture(image, textureUv); }`));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  gl.useProgram(program); gl.viewport(0, 0, 432, 432);
  const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  for (const [name, offset] of [["position", 0], ["uv", 8]]) {
    const index = gl.getAttribLocation(program, name);
    gl.enableVertexAttribArray(index); gl.vertexAttribPointer(index, 2, gl.FLOAT, false, 16, offset);
  }
  const textures = new WeakMap();
  function texture(image) {
    if (!textures.has(image)) {
      const value = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, value);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      textures.set(image, value);
    }
    return textures.get(image);
  }
  return (context, image, layer, phase) => {
    const bend = layer.bones[1], timeline = bend.timeline;
    const wave = Math.sin(phase * Math.PI * 2 + timeline.phase) - Math.sin(timeline.phase);
    const angle = wave * timeline.rotation, c = Math.cos(angle), s = Math.sin(angle), pivot = bend.bindPosition;
    const points = layer.vertices.map(vertex => {
      const [x, y] = vertex.position, [u, v] = vertex.uv, amount = vertex.weights[1];
      const dx = x - pivot[0], dy = y - pivot[1];
      const xx = x + (c * dx - s * dy + pivot[0] + wave * timeline.x - x) * amount;
      const yy = y + (s * dx + c * dy + pivot[1] + wave * timeline.y - y) * amount;
      return [xx * 144, yy * 144, (layer.source[0] + u * layer.source[2]) / image.width,
        (layer.source[1] + v * layer.source[3]) / image.height];
    });
    const values = new Float32Array(layer.triangles.flatMap(indices => indices.flatMap(index => points[index])));
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindTexture(gl.TEXTURE_2D, texture(image));
    gl.bufferData(gl.ARRAY_BUFFER, values, gl.STREAM_DRAW); gl.drawArrays(gl.TRIANGLES, 0, values.length / 4);
    context.drawImage(surface, 0, 0);
  };
}

export function createBuildingIdleRenderer() {
  const drawMesh = meshSurface();
  const light = document.createElement("canvas"); light.width = light.height = 432;
  const lit = light.getContext("2d"), part = document.createElement("canvas"); part.width = part.height = 432;
  const context = part.getContext("2d");
  return (target, rig, image, bed, growth, phase) => {
    target.clearRect(0, 0, 432, 432);
    target.save(); target.translate(216, 216); target.scale(144, 144);
    drawConstructionBed(target, bed, growth, 3); target.restore();
    for (const layer of rig.layers) {
      context.clearRect(0, 0, 432, 432);
      const timeline = layer.bones[1].timeline;
      if (timeline.rotation || timeline.x || timeline.y) drawMesh(context, image, layer, phase);
      else {
        const layout = layer.layout;
        context.drawImage(image, ...layer.source,
          216 + (layout.center[0] - layout.size[0] * layout.pivot[0]) * 144,
          216 + (layout.center[1] - layout.size[1] * layout.pivot[1]) * 144,
          layout.size[0] * 144, layout.size[1] * 144);
      }
      target.drawImage(part, 0, 0);
      if (layer.light) {
        lit.clearRect(0, 0, 432, 432); lit.globalCompositeOperation = "source-over"; lit.drawImage(part, 0, 0);
        lit.globalCompositeOperation = "source-in";
        const layout = layer.layout, x = 216 + layout.center[0] * 144;
        const y = 216 + (layout.center[1] - layout.size[1] * .55) * 144;
        const radius = layout.size[0] * 100;
        const glow = lit.createRadialGradient(x + Math.sin(phase * Math.PI * 2) * radius * .40, y, 0, x, y, radius);
        const strength = Math.pow(Math.sin(phase * Math.PI), 2) * (rig.tribe === "pebble" ? .30 : .24);
        const color = rig.tribe === "spring" ? "120,235,255" : rig.tribe === "spore" ? "255,181,143" :
          rig.tribe === "pebble" && rig.kind === "evolution-lab" ? "179,136,255" : "255,220,129";
        glow.addColorStop(0, "rgba(" + color + "," + strength + ")"); glow.addColorStop(1, "rgba(" + color + ",0)");
        lit.fillStyle = glow; lit.fillRect(0, 0, 432, 432);
        target.save(); target.globalCompositeOperation = "screen"; target.drawImage(light, 0, 0); target.restore();
      }
    }
  };
}
