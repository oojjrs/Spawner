const clamp = value => Math.max(0, Math.min(1, value));
const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
const ramp = (value, start, end) => smooth((value - start) / (end - start));
const mix = (from, to, value) => from + (to - from) * value;

export function organicConstructionPose(progress) {
  const first = ramp(progress, .18, .40), second = ramp(progress, .53, .77);
  return { stage: progress < .29 ? 1 : progress < .65 ? 2 : 3,
    extent: 1 + first + second, settle: ramp(progress, 0, .075), first, second, opening: ramp(progress, .90, 1) };
}

function triangle(context, image, uv, points, offsets) {
  const [a, b, c] = uv, [p, q, r] = points;
  const determinant = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
  if (Math.abs(determinant) < .000001) return;
  const xx = ((q[0] - p[0]) * (c[1] - a[1]) - (r[0] - p[0]) * (b[1] - a[1])) / determinant;
  const xy = ((r[0] - p[0]) * (b[0] - a[0]) - (q[0] - p[0]) * (c[0] - a[0])) / determinant;
  const yx = ((q[1] - p[1]) * (c[1] - a[1]) - (r[1] - p[1]) * (b[1] - a[1])) / determinant;
  const yy = ((r[1] - p[1]) * (b[0] - a[0]) - (q[1] - p[1]) * (c[0] - a[0])) / determinant;
  const winding = Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  const normals = points.map((point, index) => {
    const next = points[(index + 1) % 3], dx = next[0] - point[0], dy = next[1] - point[1];
    const length = Math.max(.000001, Math.hypot(dx, dy));
    return [dy / length * winding, -dx / length * winding];
  });
  context.save(); context.beginPath();
  for (const [index, point] of points.entries()) {
    const before = normals[(index + 2) % 3], after = normals[index];
    const previousOffset = offsets[(index + 2) % 3], nextOffset = offsets[index];
    const divisor = before[0] * after[1] - before[1] * after[0];
    if (Math.abs(divisor) < .000001) { context.restore(); return; }
    const x = point[0] + (previousOffset * after[1] - nextOffset * before[1]) / divisor;
    const y = point[1] + (nextOffset * before[0] - previousOffset * after[0]) / divisor;
    if (index) context.lineTo(x, y); else context.moveTo(x, y);
  }
  context.closePath(); context.clip();
  context.transform(xx, yx, xy, yy, p[0] - xx * a[0] - xy * a[1], p[1] - yx * a[0] - yy * a[1]);
  context.drawImage(image, 0, 0); context.restore();
}

export function organicShellVertices(sequence, pose, time) {
  if (sequence.organism.anatomy) return organicAnatomyVertices(sequence, pose, time);
  const rig = sequence.organism, floor = rig.ground[1];
  const growth = (pose.extent - 1) / 2;
  const width = mix(.92 * (1 + pose.settle * .02), rig.width, growth);
  const height = mix(.42745 * (1 - pose.settle * .04), rig.height, growth);
  const beat = Math.pow(Math.max(0, Math.sin(time * Math.PI * 2 / 1.5)), 6) * (1 - pose.opening);
  const opening = pose.second * .36 + pose.opening * .64;
  const idle = pose.opening >= 1 ? Math.sin(time * Math.PI * 2 / 4.8) * .008 : 0;
  const result = {};
  for (const [side, name] of ['left', 'right'].entries()) {
    const lines = rig.skin[name], vertices = [];
    const rect = sequence.parts[name];
    for (let row = 0; row < lines.length; row++) {
      const v = row / (lines.length - 1), original = rig.body[row];
      const closedY = floor - height + v * height;
      const openedY = floor - height + v * height;
      const pulse = Math.sin(Math.PI * v) * beat;
      for (let edge = 0; edge < 2; edge++) {
        const closedU = side ? edge ? original[2] : .499 : edge ? .501 : original[0];
        const closedX = (closedU - .5) * width * (1 + pulse * .018);
        const sourceX = lines[row][edge ? 2 : 0], sourceY = lines[row][1];
        const finalU = (sourceX - rect[0]) / rect[2];
        const hinge = rig.hinges[side][0];
        const openX = side ? hinge + finalU * (rig.shellWidth - hinge) : -rig.shellWidth + finalU * (rig.shellWidth + hinge);
        const openScale = width / rig.width;
        vertices.push({ uv: [sourceX, sourceY], original: [closedU, original[1]],
          point: [mix(closedX, openX * openScale, opening) + (side ? 1 : -1) * idle * (1 - v) ** 2,
            mix(closedY, openedY, opening) - pulse * .007] });
      }
    }
    result[name] = vertices;
  }
  return { width, height, floor, growth, opening, shells: result };
}

export function organicBedPose(progress) {
  return { width: 2.8, height: 1.85, spread: ramp(progress, 0, .075), ground: [0, .308] };
}

function organicAnatomyVertices(sequence, pose, time) {
  const rig = sequence.organism, growth = (pose.extent - 1) / 2, floor = rig.ground[1];
  const initialWidth = .92 * (1 + pose.settle * .02), initialHeight = .42745 * (1 - pose.settle * .04);
  const rect = sequence.parts.body, vertices = [], lines = rig.skin.body;
  const pulse = pose.opening >= 1 ? Math.sin(time * Math.PI * 2 / 4.8) * .005 :
    Math.pow(Math.max(0, Math.sin(time * Math.PI * 2 / 1.5)), 6) * .012 * (1 - pose.opening);
  for (let row = 0; row < lines.length; row++) {
    const v = row / (lines.length - 1), original = rig.body[row];
    for (let edge = 0; edge < 2; edge++) {
      const oldU = original[edge ? 2 : 0], sourceX = lines[row][edge ? 2 : 0], sourceY = lines[row][1];
      const newU = (sourceX - rect[0]) / rect[2];
      const target = [(newU - rig.bodyPivot[0]) * rig.bodySize[0], floor + (v - rig.bodyPivot[1]) * rig.bodySize[1]];
      vertices.push({ uv: [sourceX, sourceY], original: [oldU, original[1]], point: [
        mix((oldU - .5) * initialWidth, target[0], growth) * (1 + pulse * Math.sin(v * Math.PI)),
        mix(floor - (1 - v) * initialHeight, target[1], growth)] });
    }
  }
  return { width: mix(initialWidth, rig.width, growth), height: mix(initialHeight, rig.height, growth), floor, growth,
    opening: pose.opening, shells: { body: vertices } };
}

function drawShell(context, image, vertices, rect, original) {
  const uv = vertex => original ? [vertex.original[0] * rect[2], vertex.original[1] * rect[3]] :
    [vertex.uv[0] - rect[0], vertex.uv[1] - rect[1]];
  for (let row = 0; row < vertices.length / 2 - 1; row++) {
    for (const indices of [[row * 2, row * 2 + 1, row * 2 + 3], [row * 2, row * 2 + 3, row * 2 + 2]]) {
      const offsets = indices.map((index, edge) => {
        const next = indices[(edge + 1) % 3];
        const side = index % 2 === next % 2;
        const end = Math.max(index, next) <= 1 || Math.min(index, next) >= vertices.length - 2;
        return side || end ? 0 : .006;
      });
      triangle(context, image, indices.map(index => uv(vertices[index])), indices.map(index => vertices[index].point), offsets);
    }
  }
}

function createSkinRenderer(createSurface, texture) {
  const canvas = createSurface(432, 432);
  const gl = canvas.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: true, preserveDrawingBuffer: true });
  if (!gl || typeof gl.createShader !== 'function') return null;
  const shader = (type, source) => {
    const result = gl.createShader(type); gl.shaderSource(result, source); gl.compileShader(result);
    if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(result));
    return result;
  };
  const program = gl.createProgram();
  gl.attachShader(program, shader(gl.VERTEX_SHADER, 'attribute vec2 position; attribute vec2 oldUV; attribute vec2 newUV; varying vec2 oldPoint; varying vec2 newPoint; void main(){gl_Position=vec4(position.x/1.5,-position.y/1.5,0.0,1.0);oldPoint=oldUV;newPoint=newUV;}'));
  gl.attachShader(program, shader(gl.FRAGMENT_SHADER, 'precision mediump float; uniform sampler2D originalSkin; uniform sampler2D grownSkin; uniform float amount; varying vec2 oldPoint; varying vec2 newPoint; void main(){vec4 a=texture2D(originalSkin,oldPoint);vec4 b=texture2D(grownSkin,newPoint);gl_FragColor=mix(vec4(a.rgb*a.a,a.a),vec4(b.rgb*b.a,b.a),amount);}'));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);
  const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  for (const [index, name] of ['position', 'oldUV', 'newUV'].entries()) {
    const location = gl.getAttribLocation(program, name);
    gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 24, index * 8);
  }
  gl.uniform1i(gl.getUniformLocation(program, 'originalSkin'), 0);
  gl.uniform1i(gl.getUniformLocation(program, 'grownSkin'), 1);
  const amount = gl.getUniformLocation(program, 'amount'), images = new WeakMap();
  const bind = (image, slot) => {
    gl.activeTexture(gl.TEXTURE0 + slot);
    if (!images.has(image)) {
      const result = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, result);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image); images.set(image, result);
    }
    gl.bindTexture(gl.TEXTURE_2D, images.get(image));
  };
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  return (sequence, base, geometry, surfaceAmount) => {
    gl.viewport(0, 0, 432, 432); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(amount, surfaceAmount);
    bind(texture(base.partsImage, base.rig.parts.body), 0);
    for (const name of Object.keys(geometry.shells)) {
      const rect = sequence.parts[name], vertices = geometry.shells[name], data = [];
      bind(texture(sequence.sheet, rect), 1);
      for (let row = 0; row < vertices.length / 2 - 1; row++) {
        for (const index of [row * 2, row * 2 + 1, row * 2 + 3, row * 2, row * 2 + 3, row * 2 + 2]) {
          const vertex = vertices[index];
          data.push(...vertex.point, ...vertex.original, (vertex.uv[0] - rect[0]) / rect[2], (vertex.uv[1] - rect[1]) / rect[3]);
        }
      }
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.DYNAMIC_DRAW); gl.drawArrays(gl.TRIANGLES, 0, data.length / 6);
    }
    return canvas;
  };
}

export function createOrganicConstruction(createSurface) {
  const layer = createSurface(432, 432), skin = layer.getContext('2d');
  const originalLayer = createSurface(432, 432), originalSkin = originalLayer.getContext('2d');
  const textures = new WeakMap();
  const texture = (image, rect) => {
    if (!textures.has(image)) textures.set(image, new Map());
    const entries = textures.get(image), key = rect.join(':');
    if (!entries.has(key)) {
      const surface = createSurface(rect[2], rect[3]);
      surface.getContext('2d').drawImage(image, ...rect, 0, 0, rect[2], rect[3]);
      entries.set(key, surface);
    }
    return entries.get(key);
  };
  const part = (context, sequence, name, x, y, width, height, pivot) => {
    context.drawImage(sequence.sheet, ...sequence.parts[name], x - width * pivot[0], y - height * pivot[1], width, height);
  };
  const renderSkin = createSkinRenderer(createSurface, texture);
  const drawSkin = (context, sequence, base, geometry, amount) => {
    if (renderSkin) { context.drawImage(renderSkin(sequence, base, geometry, amount), -1.5, -1.5, 3, 3); return; }
    originalSkin.setTransform(1, 0, 0, 1, 0, 0); originalSkin.clearRect(0, 0, 432, 432);
    originalSkin.setTransform(144, 0, 0, 144, 216, 216);
    for (const name of Object.keys(geometry.shells)) drawShell(originalSkin, texture(base.partsImage, base.rig.parts.body), geometry.shells[name], base.rig.parts.body, true);
    skin.setTransform(1, 0, 0, 1, 0, 0); skin.clearRect(0, 0, 432, 432); skin.setTransform(144, 0, 0, 144, 216, 216);
    for (const name of Object.keys(geometry.shells)) drawShell(skin, texture(sequence.sheet, sequence.parts[name]), geometry.shells[name], sequence.parts[name], false);
    originalSkin.setTransform(1, 0, 0, 1, 0, 0); originalSkin.globalCompositeOperation = 'destination-in'; originalSkin.globalAlpha = 1 - amount;
    originalSkin.fillRect(0, 0, 432, 432); originalSkin.globalCompositeOperation = 'lighter'; originalSkin.globalAlpha = amount;
    originalSkin.drawImage(layer, 0, 0); originalSkin.globalAlpha = 1; originalSkin.globalCompositeOperation = 'source-over';
    context.drawImage(originalLayer, -1.5, -1.5, 3, 3);
  };
  const anatomy = (context, sequence, base, pose, progress, time, source, footPivot) => {
    const rig = sequence.organism, geometry = organicShellVertices(sequence, pose, time);
    const { floor, growth } = geometry;
    if (source && pose.settle < 1) { context.drawImage(source, -.512, -1.024 * (.59765625 + footPivot), 1.024, 1.024); return; }
    const drawLayer = definition => {
      const grown = definition.grown.map((value, index) => mix(value, definition.opened[index], pose.opening));
      const [x,y,w,h,rotation] = definition.start.map((value,index) => mix(value,grown[index],growth));
      const idle = pose.opening >= 1 ? Math.sin(time*Math.PI*2/4.8)*.004 : 0;
      context.save(); context.translate(x, floor + y); context.rotate(rotation + idle);
      part(context, sequence, definition.name, 0, 0, w, h, definition.pivot); context.restore();
    };
    for (const definition of rig.layers) drawLayer(definition);
    const material = rig.fixedSkin ? 1 : ramp(progress,.18,.65);
    drawSkin(context, sequence, base, geometry, material);
    context.save(); context.beginPath();
    const reveal = floor - .43 + ramp(progress,.18,.40)*2.4;
    context.rect(-4,-4,8,4+reveal); context.clip();
    for (const definition of rig.layers.filter(value => value.order === 'front')) drawLayer(definition);
    context.restore();
    if (rig.frontMask && growth > 0) {
      const [width,height] = rig.bodySize, pivot = rig.bodyPivot;
      const point = uv => [mix((uv[0]-.5)*.9384,(uv[0]-pivot[0])*width,growth), floor + mix((uv[1]-1)*.41035,(uv[1]-pivot[1])*height,growth)];
      const points = rig.frontMask.map(point);
      context.save(); context.beginPath(); context.moveTo(...points[0]);
      context.bezierCurveTo(...points[1],...points[2],...points[3]); context.lineTo(3,3); context.lineTo(-3,3); context.closePath(); context.clip();
      drawSkin(context, sequence, base, geometry, material); context.restore();
    }
    const crown = base.rig.parts.crown, crownWidth = mix(.44*(1-pose.settle*.10), rig.crown[2], growth);
    const crownRect = rig.paintedCrown ? sequence.parts.crown : crown;
    const crownHeight = mix(.44*(1-pose.settle*.15)*crown[3]/crown[2],rig.crown[2]*crownRect[3]/crownRect[2],growth);
    const crownX = rig.crown[0]*growth, crownY = mix(floor-.41035+.44*crown[3]/crown[2]*.18,floor+rig.crown[1],growth);
    context.save();
    if (rig.crownAbsorb) context.globalAlpha *= 1-ramp(growth,.45,.90);
    const crownPaint = rig.fixedCrown ? 1 : rig.paintedCrown ? ramp(growth,.08,.45) : 0;
    context.save(); context.globalAlpha *= 1-crownPaint;
    context.drawImage(base.partsImage,...crown,crownX-crownWidth/2,crownY-crownHeight,crownWidth,crownHeight); context.restore();
    if (crownPaint > 0) { context.globalAlpha *= crownPaint; context.drawImage(sequence.sheet,...crownRect,crownX-crownWidth/2,crownY-crownHeight,crownWidth,crownHeight); }
    context.restore();
    const eyeAmount = 1-ramp(progress,.18,.34);
    if (eyeAmount > 0) {
      context.save(); context.globalAlpha *= eyeAmount;
      for (const [index,name] of ['eyesClosedLeft','eyesClosedRight'].entries()) {
        const rect = base.rig.parts[name], x = (index?1:-1)*.136;
        context.drawImage(base.partsImage,...rect,x-.03,floor-.20,.06,.06*rect[3]/rect[2]);
      }
      context.restore();
    }
  };
  return function draw(context, sequence, base, pose, progress, time, source, footPivot) {
    if (sequence.organism.anatomy) { anatomy(context, sequence, base, pose, progress, time, source, footPivot); return; }
    const rig = sequence.organism, geometry = organicShellVertices(sequence, pose, time);
    const { width, height, floor, growth } = geometry;
    const opening = geometry.opening;
    part(context, sequence, 'front', 0, floor, mix(.72, 2.80, growth), mix(.14, .34, growth), [.5, .5]);
    if (source && pose.settle < 1) {
      context.drawImage(source, -.512, -1.024 * (.59765625 + footPivot), 1.024, 1.024);
      return;
    }
    const innerHeight = mix(.12, rig.innerHeight, growth);
    part(context, sequence, 'back', 0, floor + .015, width * rig.innerWidthRatio, innerHeight, [.5, 1]);
    const featureWidth = mix(.10, rig.featureWidth, growth);
    const feature = sequence.parts.feature;
    const featureBottom = floor - mix(.04, rig.featureLift, growth);
    if (sequence.featureVisible) part(context, sequence, 'feature', 0, featureBottom,
      featureWidth, featureWidth * feature[3] / feature[2], [.5, 1]);
    const crown = base.rig.parts.crown;
    const crownWidth = mix(.44 * (1 - pose.settle * .10), .54, growth);
    const crownHeight = mix(.44 * (1 - pose.settle * .15), .54, growth) * crown[3] / crown[2];
    const crownY = floor - mix(height - .44 * crown[3] / crown[2] * .18, rig.crownFloor, opening);
    const stemBottom = sequence.featureVisible ? featureBottom - featureWidth * feature[3] / feature[2] + .035 : floor - .02;
    if (stemBottom > crownY) context.drawImage(base.partsImage,
      crown[0] + crown[2] * .475, crown[1] + crown[3] * .85, crown[2] * .05, crown[3] * .14,
      -.025, crownY - .01, .05, stemBottom - crownY + .02);
    const surfaceAmount = ramp(opening, .04, .60);
    if (renderSkin) context.drawImage(renderSkin(sequence, base, geometry, surfaceAmount), -1.5, -1.5, 3, 3);
    else {
      originalSkin.setTransform(1, 0, 0, 1, 0, 0); originalSkin.clearRect(0, 0, 432, 432);
      originalSkin.setTransform(144, 0, 0, 144, 216, 216);
      for (const name of ['left', 'right']) drawShell(originalSkin, texture(base.partsImage, base.rig.parts.body),
        geometry.shells[name], base.rig.parts.body, true);
      skin.setTransform(1, 0, 0, 1, 0, 0); skin.clearRect(0, 0, 432, 432);
      skin.setTransform(144, 0, 0, 144, 216, 216);
      for (const name of ['left', 'right']) drawShell(skin, texture(sequence.sheet, sequence.parts[name]),
        geometry.shells[name], sequence.parts[name], false);
      originalSkin.setTransform(1, 0, 0, 1, 0, 0); originalSkin.globalCompositeOperation = 'destination-in';
      originalSkin.globalAlpha = 1 - surfaceAmount; originalSkin.fillRect(0, 0, 432, 432);
      originalSkin.globalCompositeOperation = 'lighter'; originalSkin.globalAlpha = surfaceAmount;
      originalSkin.drawImage(layer, 0, 0); originalSkin.globalAlpha = 1; originalSkin.globalCompositeOperation = 'source-over';
      context.drawImage(originalLayer, -1.5, -1.5, 3, 3);
    }
    const eyeVisibility = 1 - ramp(progress, .18, .34);
    if (eyeVisibility > 0) {
      context.save(); context.globalAlpha *= eyeVisibility;
      const blink = ramp(progress, 0, .025);
      for (const [index, closed] of ['eyesClosedLeft', 'eyesClosedRight'].entries()) {
        const rect = base.rig.parts[blink < 1 ? index ? 'eyesOpenRight' : 'eyesOpenLeft' : closed];
        const eyeWidth = width * mix(.05, .065, blink), eyeHeight = mix(eyeWidth * rect[3] / rect[2], width * .011, blink);
        context.drawImage(base.partsImage, ...rect, (index ? 1 : -1) * width * .145 - eyeWidth / 2,
          floor - height * .47 - eyeHeight / 2, eyeWidth, eyeHeight);
      }
      context.restore();
    }
    context.drawImage(base.partsImage, ...crown, -crownWidth / 2, crownY - crownHeight, crownWidth, crownHeight);
  };
}
