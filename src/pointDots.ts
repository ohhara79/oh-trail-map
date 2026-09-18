/**
 * National points as dots, for orbit: the hover ring, the points, and the
 * profile cursor's dot, each a fixed size on screen like the 2D pins.
 *
 * MapLibre draws a circle layer with its centre exactly on the ground, then asks
 * its terrain depth texture whether the ground covers that centre, with a margin
 * of a hair. The terrain mesh is coarser than the DEM sample the centre stands on,
 * so the answer flipped from frame to frame and the dots flickered. No style
 * property lifts a circle, so this custom layer draws them itself, a little above
 * the ground, and lets the depth buffer hide them behind a ridge.
 */
import { MercatorCoordinate, type CustomLayerInterface, type Map as MlMap } from 'maplibre-gl';

import type { NationalPoint } from './nationalPoint';
import { PIN_COLOR_NAMED, PIN_COLOR_UNNAMED, PIN_RADIUS, PIN_STROKE } from './points';

export const LAYER_POINT_DOTS = 'point-dots';

/** How high a dot's centre floats over its spot: this many pixels' worth of
 *  ground, so it looks the same at every zoom, but never under this many metres,
 *  which is what clears the coarse terrain mesh up close. */
const LIFT_PX = 3;
const LIFT_MIN_M = 2;

export type PointDots = CustomLayerInterface & {
  /** The ring behind the point a click would open, or none. */
  setHover(index: number | null): void;
  /** The dot for the GPX point the profile's cursor is on, or none. */
  setCursor(at: { lat: number; lon: number; color: string } | null): void;
};

type Rgba = [number, number, number, number];

/** A dot's look: fill, then a ring of `stroke` pixels outside `radius`, as
 *  MapLibre's circle-radius and circle-stroke-width drew it. */
type Look = { fill: Rgba; ring: Rgba; radius: number; stroke: number };

const WHITE: Rgba = [1, 1, 1, 1];
const HOVER: Look = { fill: WHITE, ring: [0x1f / 255, 0x23 / 255, 0x28 / 255, 0.5], radius: PIN_RADIUS + PIN_STROKE + 2, stroke: 1 };
// MapLibre strokes outside the radius and Leaflet across it, so 4.5 + 3 is the
// 2D ProfileCursor's 6 with its 3px ring.
const CURSOR_RADIUS = 4.5;
const CURSOR_STROKE = 3;

/** Floats per instance: centre, fill, ring, radius, stroke. */
const STRIDE = 3 + 4 + 4 + 2;

const VERTEX = `#version 300 es
uniform mat4 u_matrix;
uniform vec2 u_viewport;
layout(location = 0) in vec2 a_corner;
layout(location = 1) in vec3 a_centre;
layout(location = 2) in vec4 a_fill;
layout(location = 3) in vec4 a_ring;
layout(location = 4) in vec2 a_size;
out vec2 v_px;
out vec4 v_fill;
out vec4 v_ring;
out vec2 v_size;
void main() {
  // A pixel of antialiasing past the ring's edge.
  float outer = a_size.x + a_size.y + 1.0;
  v_px = a_corner * outer;
  v_fill = a_fill;
  v_ring = a_ring;
  v_size = a_size;
  // Flat to the screen, at its centre's depth, so the whole disc is hidden or
  // shown by the ground in front of it and never cut by the slope it stands on.
  gl_Position = u_matrix * vec4(a_centre, 1.0);
  gl_Position.xy += v_px * 2.0 / u_viewport * gl_Position.w;
}`;

const FRAGMENT = `#version 300 es
precision mediump float;
in vec2 v_px;
in vec4 v_fill;
in vec4 v_ring;
in vec2 v_size;
out vec4 fragColor;
void main() {
  float d = length(v_px);
  float r = v_size.x;
  float outer = r + v_size.y;
  vec4 color = mix(v_fill, v_ring, smoothstep(r - 0.5, r + 0.5, d));
  float alpha = color.a * (1.0 - smoothstep(outer - 0.5, outer + 0.5, d));
  if (alpha <= 0.0) discard;
  fragColor = vec4(color.rgb * alpha, alpha);
}`;

function rgba(hex: string, alpha = 1): Rgba {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, alpha];
}

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? 'shader');
  return shader;
}

export function createPointDots(
  map: MlMap,
  points: readonly NationalPoint[],
  hidden: () => ReadonlySet<string>,
): PointDots {
  const looks = points.map(
    (p): Look => ({
      fill: rgba(p.name !== '' ? PIN_COLOR_NAMED : PIN_COLOR_UNNAMED),
      ring: WHITE,
      radius: PIN_RADIUS,
      stroke: PIN_STROKE,
    }),
  );
  // Named points above the rest, for the reason given at zIndexOffset in points.ts.
  const order = points.map((_, i) => i).sort((a, b) => Number(points[a].name !== '') - Number(points[b].name !== ''));

  // Metres from an origin near the points, as in pointBalls.ts: a float32 is only
  // good to a few metres across mercator's 0..1.
  const origin = MercatorCoordinate.fromLngLat([points[0]?.lon ?? 0, points[0]?.lat ?? 0]);
  const unit = origin.meterInMercatorCoordinateUnits();
  // The points, the hover ring and the cursor.
  const instances = new Float32Array((points.length + 2) * STRIDE);
  let hover: number | null = null;
  let cursor: { lat: number; lon: number; look: Look } | null = null;
  const matrix = new Float32Array(16);

  let gl: WebGL2RenderingContext | null = null;
  let program: WebGLProgram | null = null;
  let vao: WebGLVertexArrayObject | null = null;
  let buffers: WebGLBuffer[] = [];
  let instanceBuffer: WebGLBuffer | null = null;
  let matrixLocation: WebGLUniformLocation | null = null;
  let viewportLocation: WebGLUniformLocation | null = null;

  return {
    id: LAYER_POINT_DOTS,
    type: 'custom',
    renderingMode: '3d',

    onAdd(_map, context) {
      gl = context;
      program = gl.createProgram()!;
      const shaders = [compile(gl, gl.VERTEX_SHADER, VERTEX), compile(gl, gl.FRAGMENT_SHADER, FRAGMENT)];
      for (const shader of shaders) gl.attachShader(program, shader);
      gl.linkProgram(program);
      for (const shader of shaders) gl.deleteShader(shader);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? 'program');
      matrixLocation = gl.getUniformLocation(program, 'u_matrix');
      viewportLocation = gl.getUniformLocation(program, 'u_viewport');

      vao = gl.createVertexArray();
      gl.bindVertexArray(vao);

      const cornerBuffer = gl.createBuffer()!;
      gl.bindBuffer(gl.ARRAY_BUFFER, cornerBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

      instanceBuffer = gl.createBuffer()!;
      gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, instances.byteLength, gl.DYNAMIC_DRAW);
      for (const [location, size, offset] of [[1, 3, 0], [2, 4, 3], [3, 4, 7], [4, 2, 11]]) {
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(location, size, gl.FLOAT, false, STRIDE * 4, offset * 4);
        gl.vertexAttribDivisor(location, 1);
      }

      gl.bindVertexArray(null);
      buffers = [cornerBuffer, instanceBuffer];
    },

    onRemove() {
      if (!gl) return;
      for (const buffer of buffers) gl.deleteBuffer(buffer);
      gl.deleteVertexArray(vao);
      gl.deleteProgram(program);
      gl = null;
    },

    render(context, options) {
      if (!program || !vao || !instanceBuffer) return;
      const m = options.defaultProjectionData.mainMatrix;
      const canvas = map.getCanvas();
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      /** Where a mercator coordinate lands on screen, in CSS pixels. */
      const screen = (c: MercatorCoordinate): [number, number] | null => {
        const w = m[3] * c.x + m[7] * c.y + m[11] * c.z + m[15];
        if (w <= 0) return null;
        return [
          (((m[0] * c.x + m[4] * c.y + m[8] * c.z + m[12]) / w) * width) / 2,
          (((m[1] * c.x + m[5] * c.y + m[9] * c.z + m[13]) / w) * height) / 2,
        ];
      };

      let count = 0;
      const push = (lon: number, lat: number, look: Look) => {
        const ground = map.queryTerrainElevation([lon, lat]);
        if (ground === null) return;
        // Metres per pixel at the spot, from a metre east and a metre south of it:
        // the longer of the two axes of the ellipse they span, which is a metre
        // across the screen rather than one foreshortened into it.
        const here = MercatorCoordinate.fromLngLat([lon, lat], ground);
        const at = screen(here);
        if (!at) return;
        const east = screen(new MercatorCoordinate(here.x + unit, here.y, here.z));
        const south = screen(new MercatorCoordinate(here.x, here.y + unit, here.z));
        if (!east || !south) return;
        const [ex, ey] = [east[0] - at[0], east[1] - at[1]];
        const [sx, sy] = [south[0] - at[0], south[1] - at[1]];
        const t = ex * ex + ey * ey + sx * sx + sy * sy;
        const det = ex * sy - ey * sx;
        const pxPerMetre = Math.sqrt((t + Math.sqrt(Math.max(0, t * t - 4 * det * det))) / 2);
        const lift = Math.max(LIFT_MIN_M, pxPerMetre > 0 ? LIFT_PX / pxPerMetre : 0);
        const c = MercatorCoordinate.fromLngLat([lon, lat], ground + lift);
        instances.set(
          [
            (c.x - origin.x) / unit,
            (c.y - origin.y) / unit,
            c.z / unit,
            ...look.fill,
            ...look.ring,
            look.radius,
            look.stroke,
          ],
          count * STRIDE,
        );
        count++;
      };

      // The same order the circle layers drew in: the ring behind its point, the
      // points, then the cursor above them, as its pane is in 2D.
      const skip = hidden();
      if (hover !== null && !skip.has(points[hover].code)) push(points[hover].lon, points[hover].lat, HOVER);
      for (const i of order) {
        if (!skip.has(points[i].code)) push(points[i].lon, points[i].lat, looks[i]);
      }
      if (cursor) push(cursor.lon, cursor.lat, cursor.look);
      if (count === 0) return;

      // mainMatrix × translate(origin) × scale(unit), column-major.
      for (let i = 0; i < 4; i++) {
        matrix[i] = m[i] * unit;
        matrix[4 + i] = m[4 + i] * unit;
        matrix[8 + i] = m[8 + i] * unit;
        matrix[12 + i] = m[i] * origin.x + m[4 + i] * origin.y + m[12 + i];
      }

      context.useProgram(program);
      context.uniformMatrix4fv(matrixLocation, false, matrix);
      context.uniform2f(viewportLocation, width, height);
      context.bindVertexArray(vao);
      context.bindBuffer(context.ARRAY_BUFFER, instanceBuffer);
      context.bufferSubData(context.ARRAY_BUFFER, 0, instances, 0, count * STRIDE);
      // Tested against the ground but written to no depth, so the dots overlap in
      // the order above, as the circles did. MapLibre set the mask on for this
      // layer and expects it back on.
      context.depthMask(false);
      context.drawArraysInstanced(context.TRIANGLE_STRIP, 0, 4, count);
      context.depthMask(true);
      context.bindVertexArray(null);
    },

    setHover(index) {
      if (index === hover) return;
      hover = index;
      map.triggerRepaint();
    },

    setCursor(at) {
      cursor = at && {
        lat: at.lat,
        lon: at.lon,
        look: { fill: rgba(at.color), ring: WHITE, radius: CURSOR_RADIUS, stroke: CURSOR_STROKE },
      };
      map.triggerRepaint();
    },
  };
}
