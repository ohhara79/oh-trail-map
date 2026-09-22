/**
 * National points as balls floating over the ground, for walking and playback.
 *
 * MapLibre has no layer that draws a sphere — a circle or symbol is a flat
 * billboard, and a fill-extrusion only stacks slabs — so this is a custom WebGL2
 * layer: one sphere mesh drawn once per point. In '3d' rendering mode it shares
 * the terrain's depth buffer, so a ridge in front of a ball hides it.
 *
 * The same ground heights the balls were last drawn at are what pick() aims
 * against, so the crosshair hits a ball exactly where you see it.
 */
import { MercatorCoordinate, type CustomLayerInterface, type Map as MlMap } from 'maplibre-gl';

import { METRES_PER_DEG } from './geo';
import type { NationalPoint } from './nationalPoint';
import { PIN_COLOR_NAMED, PIN_COLOR_UNNAMED } from './points';
import { BALL_HEIGHT, BALL_RADIUS } from './scene3d';

export const LAYER_POINT_BALLS = 'point-balls';

export type PointBalls = CustomLayerInterface & {
  /**
   * The nearest point whose ball the ray from `from` hits, looking along `yaw` and
   * `look` in degrees — a walker's pose. `pad` widens each ball by that angle in
   * radians, so aiming just off its edge still counts. Only the balls drawn last
   * frame, among those `keep` allows; it is asked only of a ball the ray hits,
   * nearer than any hit so far, with the height of its centre.
   */
  pick(
    from: { lat: number; lon: number; alt: number },
    yaw: number,
    look: number,
    pad: number,
    keep: (lat: number, lon: number, alt: number) => boolean,
  ): NationalPoint | undefined;
  /** Where on the canvas, in CSS pixels, a spot `alt` metres above sea level was
   *  drawn last frame, or null before the first frame or behind the camera. */
  project(lon: number, lat: number, alt: number): { x: number; y: number } | null;
  /** One more ball, in `color`, over the GPX point the profile's cursor is on, or
   *  none. Drawn like a point's, and never picked: the orbit dot opens nothing either. */
  setCursor(at: { lat: number; lon: number; color: string } | null): void;
  /** Where the eye is, so a ball you are standing in can be left out — see
   *  NEAR_CULL. Null in orbit, where no ball is drawn anyway, and through the flight
   *  down into walking, which has no walker yet. */
  setEye(at: { lat: number; lon: number; alt: number } | null): void;
};

/** Rings from pole to pole, and segments around each. Enough that the edge of a
 *  ball at your feet does not show its corners. */
const STACKS = 16;
const SLICES = 24;

/**
 * A ball whose centre is nearer the eye than this is not drawn at all.
 *
 * Walking, the eye is 1.7 m up and a ball's centre 2 m, so standing on its spot puts
 * the camera 0.3 m from that centre — inside a sphere of radius 1, with the near plane
 * 0.28 m out (see the firstPerson.ts module comment) and nothing left to clip it away.
 * What you see then is the sphere's own inside, edge to edge, and the view is gone
 * until you walk off. Leaving playback stands you on the cursor's point exactly like
 * that, and walking straight onto a national point does the same.
 *
 * The margin over BALL_RADIUS drops the ball a stride before you reach it rather than
 * at its skin. At this distance it already spans 2·asin(BALL_RADIUS / NEAR_CULL) = 60°,
 * more than the 50° WALK_FOV, so there is nothing left of it to see anyway — which is
 * what makes 2 m the right amount and not 1.5 or 4.
 */
export const NEAR_CULL = BALL_RADIUS + 1;

const VERTEX = `#version 300 es
uniform mat4 u_matrix;
layout(location = 0) in vec3 a_pos;
layout(location = 1) in vec3 a_centre;
layout(location = 2) in vec3 a_color;
out vec3 v_normal;
out vec3 v_color;
void main() {
  v_normal = a_pos;
  v_color = a_color;
  gl_Position = u_matrix * vec4(a_centre + a_pos * ${BALL_RADIUS.toFixed(3)}, 1.0);
}`;

// The frame is mercator's: x east, y south, z up. The sun stands high in the
// south-west, and a highlight towards it is what makes a disc read as a ball.
const FRAGMENT = `#version 300 es
precision mediump float;
in vec3 v_normal;
in vec3 v_color;
out vec4 fragColor;
const vec3 SUN = normalize(vec3(-0.4, 0.4, 0.82));
void main() {
  float light = max(dot(normalize(v_normal), SUN), 0.0);
  vec3 color = v_color * (0.6 + 0.5 * light) + vec3(0.3) * pow(light, 24.0);
  fragColor = vec4(color, 1.0);
}`;

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** A unit sphere as positions, which are also its normals, and triangle indices. */
function sphere(): { positions: Float32Array; indices: Uint16Array } {
  const positions: number[] = [];
  for (let i = 0; i <= STACKS; i++) {
    const polar = (i / STACKS) * Math.PI;
    for (let j = 0; j <= SLICES; j++) {
      const around = (j / SLICES) * 2 * Math.PI;
      positions.push(Math.sin(polar) * Math.cos(around), Math.sin(polar) * Math.sin(around), Math.cos(polar));
    }
  }
  const indices: number[] = [];
  const row = SLICES + 1;
  for (let i = 0; i < STACKS; i++) {
    for (let j = 0; j < SLICES; j++) {
      const a = i * row + j;
      indices.push(a, a + row, a + 1, a + 1, a + row, a + row + 1);
    }
  }
  return { positions: new Float32Array(positions), indices: new Uint16Array(indices) };
}

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? 'shader');
  return shader;
}

export function createPointBalls(
  map: MlMap,
  points: readonly NationalPoint[],
  hidden: () => ReadonlySet<string>,
): PointBalls {
  const colors = points.map((p) => rgb(p.name !== '' ? PIN_COLOR_NAMED : PIN_COLOR_UNNAMED));
  /** The ground under each ball as last drawn, or NaN where none was: hidden, or
   *  its terrain not loaded yet. */
  const grounds = new Float64Array(points.length).fill(NaN);

  // Mercator coordinates run 0..1 across the world, where a float32 is only good to
  // a few metres. So the shader works in metres from an origin near the points, and
  // the step from there to mercator is taken here, in doubles, once a frame.
  const origin = MercatorCoordinate.fromLngLat([points[0]?.lon ?? 0, points[0]?.lat ?? 0]);
  const unit = origin.meterInMercatorCoordinateUnits();
  // One slot past the points for the cursor's ball.
  const instances = new Float32Array((points.length + 1) * 6);
  let cursor: { lat: number; lon: number; color: [number, number, number] } | null = null;
  let eye: { lat: number; lon: number; alt: number } | null = null;
  const matrix = new Float32Array(16);
  /** mainMatrix as last drawn with, for project(). */
  let drawn: Float64Array | null = null;

  let gl: WebGL2RenderingContext | null = null;
  let program: WebGLProgram | null = null;
  let vao: WebGLVertexArrayObject | null = null;
  let buffers: WebGLBuffer[] = [];
  let instanceBuffer: WebGLBuffer | null = null;
  let matrixLocation: WebGLUniformLocation | null = null;
  let indexCount = 0;

  return {
    id: LAYER_POINT_BALLS,
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

      const mesh = sphere();
      indexCount = mesh.indices.length;
      vao = gl.createVertexArray();
      gl.bindVertexArray(vao);

      const positionBuffer = gl.createBuffer()!;
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, mesh.positions, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

      instanceBuffer = gl.createBuffer()!;
      gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, instances.byteLength, gl.DYNAMIC_DRAW);
      for (const [location, offset] of [[1, 0], [2, 12]]) {
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(location, 3, gl.FLOAT, false, 24, offset);
        gl.vertexAttribDivisor(location, 1);
      }

      const indexBuffer = gl.createBuffer()!;
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);

      gl.bindVertexArray(null);
      buffers = [positionBuffer, instanceBuffer, indexBuffer];
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
      drawn = Float64Array.from(options.defaultProjectionData.mainMatrix);
      // Every frame, since terrain tiles keep arriving and a finer one moves the
      // ground by metres. A few hundred lookups is nothing next to the draw.
      const skip = hidden();
      // The eye in the same local metres as the instances, so the cull is measured in
      // the frame the shader scales BALL_RADIUS in and NEAR_CULL means the same thing
      // as the size you see.
      const eyeAt = eye && MercatorCoordinate.fromLngLat([eye.lon, eye.lat], eye.alt);
      const ex = eyeAt ? (eyeAt.x - origin.x) / unit : 0;
      const ey = eyeAt ? (eyeAt.y - origin.y) / unit : 0;
      const ez = eyeAt ? eyeAt.z / unit : 0;
      const near = (x: number, y: number, z: number) =>
        eyeAt !== null && (x - ex) ** 2 + (y - ey) ** 2 + (z - ez) ** 2 < NEAR_CULL ** 2;
      let count = 0;
      for (let i = 0; i < points.length; i++) {
        const point = points[i];
        const ground = skip.has(point.code) ? null : map.queryTerrainElevation([point.lon, point.lat]);
        grounds[i] = ground ?? NaN;
        if (ground === null) continue;
        const at = MercatorCoordinate.fromLngLat([point.lon, point.lat], ground + BALL_HEIGHT);
        const x = (at.x - origin.x) / unit;
        const y = (at.y - origin.y) / unit;
        const z = at.z / unit;
        // Back to NaN, the same as a ball whose terrain has not loaded: grounds is
        // what pick() aims against, and it is only ever the balls drawn last frame.
        // So the crosshair stops reaching one the moment it stops being there.
        if (near(x, y, z)) {
          grounds[i] = NaN;
          continue;
        }
        instances.set([x, y, z, ...colors[i]], count * 6);
        count++;
      }
      const cursorGround = cursor && map.queryTerrainElevation([cursor.lon, cursor.lat]);
      if (cursor && cursorGround != null) {
        const at = MercatorCoordinate.fromLngLat([cursor.lon, cursor.lat], cursorGround + BALL_HEIGHT);
        const x = (at.x - origin.x) / unit;
        const y = (at.y - origin.y) / unit;
        const z = at.z / unit;
        if (!near(x, y, z)) {
          instances.set([x, y, z, ...cursor.color], count * 6);
          count++;
        }
      }
      if (count === 0) return;

      // mainMatrix × translate(origin) × scale(unit), column-major.
      const m = options.defaultProjectionData.mainMatrix;
      for (let i = 0; i < 4; i++) {
        matrix[i] = m[i] * unit;
        matrix[4 + i] = m[4 + i] * unit;
        matrix[8 + i] = m[8 + i] * unit;
        matrix[12 + i] = m[i] * origin.x + m[4 + i] * origin.y + m[12 + i];
      }

      context.useProgram(program);
      context.uniformMatrix4fv(matrixLocation, false, matrix);
      context.bindVertexArray(vao);
      context.bindBuffer(context.ARRAY_BUFFER, instanceBuffer);
      context.bufferSubData(context.ARRAY_BUFFER, 0, instances, 0, count * 6);
      context.drawElementsInstanced(context.TRIANGLES, indexCount, context.UNSIGNED_SHORT, 0, count);
      context.bindVertexArray(null);
    },

    pick(from, yaw, look, pad, keep) {
      // Local metres east, north and up of the eye, flat: MapLibre's terrain is flat
      // in mercator too, and cos(lat) barely moves over the few kilometres you can
      // see a ball across.
      const rad = Math.PI / 180;
      const dir = [
        Math.cos(look * rad) * Math.sin(yaw * rad),
        Math.cos(look * rad) * Math.cos(yaw * rad),
        Math.sin(look * rad),
      ];
      const skip = hidden();
      const slack = Math.tan(pad);
      let best: NationalPoint | undefined;
      let bestT = Infinity;
      for (let i = 0; i < points.length; i++) {
        const point = points[i];
        if (Number.isNaN(grounds[i]) || skip.has(point.code)) continue;
        const c = [
          (point.lon - from.lon) * METRES_PER_DEG * Math.cos(from.lat * rad),
          (point.lat - from.lat) * METRES_PER_DEG,
          grounds[i] + BALL_HEIGHT - from.alt,
        ];
        const t = c[0] * dir[0] + c[1] * dir[1] + c[2] * dir[2];
        if (t <= 0 || t >= bestT) continue;
        const off = Math.sqrt(Math.max(0, c[0] ** 2 + c[1] ** 2 + c[2] ** 2 - t * t));
        if (off <= BALL_RADIUS + t * slack && keep(point.lat, point.lon, grounds[i] + BALL_HEIGHT)) {
          best = point;
          bestT = t;
        }
      }
      return best;
    },

    setCursor(at) {
      cursor = at && { lat: at.lat, lon: at.lon, color: rgb(at.color) };
      map.triggerRepaint();
    },

    setEye(at) {
      // No repaint asked for here, unlike setCursor: this is called every frame, and a
      // repaint a frame would keep the map drawing while you stand still. Nothing is
      // lost, because the cull can only change when the camera moves, and a camera
      // that moves has already jumped the map (firstPerson.ts place()).
      eye = at;
    },

    project(lon, lat, alt) {
      if (!drawn) return null;
      const m = drawn;
      const c = MercatorCoordinate.fromLngLat([lon, lat], alt);
      const w = m[3] * c.x + m[7] * c.y + m[11] * c.z + m[15];
      if (w <= 0) return null;
      const x = (m[0] * c.x + m[4] * c.y + m[8] * c.z + m[12]) / w;
      const y = (m[1] * c.x + m[5] * c.y + m[9] * c.z + m[13]) / w;
      const canvas = map.getCanvas();
      return { x: ((x + 1) / 2) * canvas.clientWidth, y: ((1 - y) / 2) * canvas.clientHeight };
    },
  };
}
