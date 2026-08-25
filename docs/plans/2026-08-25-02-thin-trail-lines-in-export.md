# Thin trail lines in exported PNG/SVG

## Context

Exported PNGs showed the GPX trail far thicker than everything else in the
image — a highlighter stroke laid over the map rather than another line on it.

The cause was one expression in the exporter:

```ts
const strokeWidth = TRAIL_WEIGHT * plan.achievedScale;   // src/export.ts:267
```

That multiplier looks right and is wrong, for a reason specific to how this
exporter works. A screenshot-style export magnifies the pixels already on
screen, so every line in it — trail and basemap alike — grows together, and
scaling the stroke is exactly correct. But `src/export.ts` deliberately does the
opposite: it re-renders the visible bounds at a **higher tile zoom**, so the
tile server hands back genuinely more detailed imagery. Those tiles arrive with
their roads, casings and labels at their **native** weight, roughly the same
1–5 px they occupy on screen, no matter what scale was requested.

So the basemap does not scale, and multiplying only the trail left it 4× or 8×
thicker than everything underneath it. On screen a 4 px trail sits nicely
against ~4 px roads; in a 4× export a 16 px trail smothers them.

The fix is to hold the trail's width constant in **output pixels**. Since the
right absolute width depends on the basemap and the map's scale — a 3 px line
reads differently over Esri satellite than over Carto Light — it also became a
user setting rather than a new constant, chosen during planning over a
square-root compromise (`weight * sqrt(scale)`) and over simply halving the
existing constant.

This supersedes the `lineWidth = 4 * achievedScale` decision recorded in
[`2026-08-25-01-gpx-trail-map-web-app.md`](2026-08-25-01-gpx-trail-map-web-app.md).

## Approach

### 1. `src/trails.ts` — width joins colour as a resolved setting

The original design already established that a stroke *colour* is decided in
exactly one place, `colorOf()`, so the map layers and both exporters can never
drift apart. Width now follows the same pattern rather than inventing a second
one:

```ts
export function weightOf(settings: Settings): number {
  const w = Number(settings.trailWeight);
  if (!Number.isFinite(w)) return DEFAULT_TRAIL_WEIGHT;
  return Math.min(TRAIL_WEIGHT_MAX, Math.max(TRAIL_WEIGHT_MIN, w));
}
```

`TRAIL_WEIGHT = 4` is replaced by `trailWeight` on `Settings`, with
`DEFAULT_TRAIL_WEIGHT = 3` (a notch thinner than the old hard-coded 4) and
bounds of 1–10. The clamp is not defensive noise: the value round-trips through
IndexedDB, and a stale or hand-edited record must not be able to render every
trail invisible or absurdly fat.

`restyleTrail()` previously re-applied only `color`. It now sets `weight` too —
without that the slider would move new trails but leave existing polylines
untouched.

### 2. `src/export.ts` — stop scaling the stroke

```ts
const strokeWidth = weightOf(settings);
```

Both consumers pick this up unchanged: `ctx.lineWidth` for PNG and
`stroke-width` for the SVG `<polyline>`s, so the two formats stay identical to
each other as well as to the screen. The file header comment now records *why*
the stroke is unscaled, since the multiplier is the intuitive thing to write and
will otherwise be reintroduced by whoever reads the code next.

`drawAttribution()` keeps its `12 * scale` font sizing. The credit is text meant
to stay legible at a glance, not a map feature competing with road weights.
`SVG_TOLERANCE` was already expressed in exported pixels and needed no change.

### 3. `index.html`, `src/ui.ts`, `src/main.ts` — the control

A range input beside the uniform-colour toggle, mirroring the existing
`uniformColor` binding: `input` event, live `<output>` label, restyle every
trail, persist. It updates the map as it is dragged, so the width can be judged
against the actual basemap before exporting.

No estimate refresh is wired to it — width affects neither canvas size nor tile
count, so `planExport()` is unaffected.

### 4. Persistence

No IndexedDB migration and no `DB_VERSION` bump: `loadSettings()` already
returns `{ ...DEFAULT_SETTINGS, ...stored }` (`src/store.ts:76`), so existing
saved settings acquire `trailWeight` on read.

`src/main.ts` had a second, hand-copied settings literal as the
`loadSettings().catch()` fallback, which would have silently dropped the new
field on any IndexedDB failure. It now falls back to `DEFAULT_SETTINGS` itself,
so the duplication cannot rot again.

## Files

| File | Change |
|------|--------|
| `src/trails.ts` | `trailWeight` on `Settings`, `weightOf()` resolver, weight applied in `buildTrail` and `restyleTrail` |
| `src/export.ts` | `strokeWidth = weightOf(settings)` — no `achievedScale` multiplier; header comment explains why |
| `index.html` | "Trail width" range input in the trail-style block |
| `src/style.css` | Range/output sizing inside `.row` |
| `src/ui.ts` | `trailWidth` refs, `onTrailWidthChange` callback, `applySettings` restores the slider |
| `src/main.ts` | Width handler, `DEFAULT_SETTINGS` as the settings fallback |
| `README.md` | Corrects "stroke width scaled to match", adds the feature bullet |

## Verification

Done:

- `npm run build` — `tsc --noEmit` plus the Vite bundle, both clean. The new
  required field on `Settings` is what makes the typecheck meaningful here: any
  missed construction site fails the build.

Still requires a manual browser pass — the visual result is the whole point of
the change and nothing above covers it:

1. `npm run dev`, import a `samples/*.gpx`.
2. Drag **Trail width** → the on-screen line thickens and thins live, including
   trails imported before the drag.
3. Reload → the chosen width returns from IndexedDB.
4. Export **PNG at 4×** and compare the trail against the basemap's road
   casings. It should read as one more line on the map. This is the pass/fail
   test for the change.
5. Export at 1× and 8× → the trail's absolute pixel width is identical in all
   three files, while the basemap detail still increases with scale.
6. Export **SVG at 4×** → each `<polyline>` carries the same `stroke-width` as
   the PNG line, and the paths remain individually selectable.
7. Toggle "Use one color for all trails" → colour and width stay consistent
   between screen and file.

## Follow-up

- The attribution box is now the one element still scaled with `achievedScale`.
  That is deliberate, but it means at 8× the credit is proportionally larger
  than at 1×; a fixed physical size would need the chosen-DPI export already
  noted as future work in the original plan.
- Width is global, not per-trail. Per-trail width would be a natural extension
  of the trail list row, alongside the existing colour swatch — the resolver
  signature `weightOf(settings)` would become `weightOf(trail, settings)`,
  matching `colorOf`.
