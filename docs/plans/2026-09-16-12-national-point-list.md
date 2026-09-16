# Control national points one by one, like trails

## Context

`#points-toggle` — "Show National Point Numbers" — was one checkbox for all 272 pins. It was
all-or-nothing: no way to keep the handful of signs along a ridge and drop the 168 in 관악구, and
no way to find one 지점번호 among 272.

The TRAILS block already solves that shape of problem, so national points get the same one: a
row per point, a filter, and a tri-state master checkbox scoped to whatever the filter left. The
old toggle is retired — the master checkbox is its replacement, and `Settings.showPoints` goes
with it.

Four decisions were taken before any of it was written, because each one changes what gets
built:

1. **One row per point**, not one per 사물유형 (6) or per 시/군/구 (5). 272 rows is what makes
   the filter load-bearing rather than decorative.
2. **The filter matches every column** — 이름, 지점번호, 사물유형, 시/도, 시/군/구 — token-AND.
   Half the file has no 이름, so a name-only filter would leave 129 points unreachable.
3. **A row click goes to the point and opens its popup**, as a trail row selects and zooms.
4. **The block goes last**: Basemap → Trails → National Points. 272 rows above Trails would push
   it off the screen, and `style.css` documents `.panel-body` as the panel's only scroller.

Measured against `data/national_points_w_name.tsv`: 273 rows → 272 points after the documented
다사49293899 dedup, 144 of them named, 6 사물유형 values, 5 시/도 + 시/군/구 pairs. Every cell is
already NFC. The longest detail line is 44 characters, so it is always clipped in a 320px drawer.

## Change

### `src/trails.ts` — `Settings`, and one matcher split in two

`showPoints: boolean` became `hiddenPoints: string[]`.

The **off** set, not the on set. Nothing hidden is the usual state and serialises to `[]`; a
point added to a future TSV is drawn by default, which is the same default `record?.visible ??
true` gives a trail with no record; and a code left behind when a point leaves the TSV matches no
row and is inert.

One array on `Settings` rather than a record per point in its own store. `run()` in `store.ts`
opens a transaction per request, so a `points` store would cost 272 transactions every time the
master checkbox is clicked — plus a `DB_VERSION` bump, an upgrade path and three more functions.
The trails store exists because trails are user-supplied files whose set changes; the TSV is a
bundled module constant with stable ten-character keys. 272 × 10 characters is 3 KB in one record.

`fold` is now exported and `matchesTokens` is split: `matchesFolded(folded, tokens)` holds the
test, and `matchesTokens(name, tokens)` folds and calls it. The point list folds its 272
haystacks once at boot rather than on every keystroke, and this is how it does that while staying
the *same* test — `searchTokens`'s docstring already says the tokeniser is shared so the filter
and the highlighter can never diverge, and the same argument covers the matcher.

### `src/store.ts` — one whitelist line

```ts
hiddenPoints: Array.isArray(stored?.hiddenPoints)
  ? stored.hiddenPoints.filter((code): code is string => typeof code === 'string')
  : DEFAULT_SETTINGS.hiddenPoints,
```

`Array.isArray` rather than `??`: the key is new, and a record from a tampered or future build
must not reach `new Set(...)` as something that is not one.

**A saved `showPoints: false` is not migrated**, and the comment now says so. Turning `false`
into 272 codes needs the point list, and importing `points.ts` here would drag Leaflet and the
TSV into the persistence module and invert the layering — `store.ts` imports one type from
`trails.ts` and nothing else. Doing it in `main.ts` instead would mean a legacy field living on
`Settings` forever to service one boolean. The affected population is people who explicitly
turned points off; their pins come back once, and one click on the new master checkbox puts them
away again — which is the very affordance this change adds. The precedent is explicit: that
comment already said dropped fields vanish, and `2026-09-13-05` dropped three the same way.

### `src/points.ts` — row text, and a layer that can hide one pin

**`PointRow` + `pointRows()`.** Built once at boot: normalising, joining and folding 272 rows on
every character typed has a fixed answer. `detail` is `이름 · 사물유형 · 시/도 시/군/구` with the
missing parts dropped — the same `filter(Boolean)` join `popupContent` makes, for the same reason
a row with no 이름 must not read as `· 위치안내(표시)판`. `haystack` is `fold(code + detail)`,
built from the strings that are drawn so a match always has something to mark. `color` comes from
the same `PIN_COLOR_NAMED` / `PIN_COLOR_UNNAMED` split the pins use, so a swatch and its pin
cannot disagree. `code` is deliberately **not** normalised: it has to stay the same string as
`NationalPoint.code`, or a hidden-set key would not match the point it hides.

**`createPointsLayer` returns a `PointsLayer`.** The markers go into a `Map<code, Marker>` keyed
on 지점번호, which `parseNationalPoints` has already deduplicated; the group is added to the map
once at boot and never removed, and `sync(hidden)` decides what is in it. The `show ===
group.hasLayer(marker)` guard is the same early return `setVisible` carries: hiding one point
must not re-add the other 271. Hiding all 272 is 272 `removeLayer` calls — exactly what
`LayerGroup.onRemove` already did when the whole group came off, so the worst case is unchanged.

### `src/listUi.ts` — new

`highlightName` (moved out of `ui.ts` unchanged), `countLabel` and `setTristate`: the three things
the two lists must not implement differently. `setTristate` is the one that earns it — its whole
point is that `indeterminate` is a property `checked` does not clear.

Deliberately **not** a shared list class. Parameterising one takes a data type, a key function, a
visibility predicate, a row builder, two empty messages, a count element and five ids — more
machinery than either list has code — and the two differ in the half that matters: selection,
`scrollIntoView`, expand-all and the ▶ button are the trail list's alone; the five-column filter
and the cheap update path are the point list's. The trail list also carries a dozen plan docs'
worth of behaviour that a refactor would put at risk for nothing visible.

### `src/pointsList.ts` — new

`class PointsList`, owning `#point-*`, built by `main.ts` beside `Ui`. Its own module rather than
a second half of `ui.ts`, which already owns the drawer, the basemap radios, the notices and
three floating buttons. It renders and reports; `main.ts` holds the hidden set and hands it back
on every render, so a row can never disagree with the pin.

**`render(hidden)` is the only entry point, and decides for itself whether to rebuild.** Only the
filter can change *which* rows exist; a checkbox changes what a row *says*. Rebuilding 272 rows
to change one `checked` would throw the focus of whoever just pressed Space out to `<body>`,
leaving them unable to carry on down the list, and discard the panel's scroll position for
nothing. `sameRows()` — 272 string compares against `li.dataset.pointCode`, no allocation —
decides, and `syncChecks()` runs on both paths so a freshly built row and a re-synced one are set
by the same line. The precedent is already in `ui.ts`: `setAllNamesExpanded` walks the rendered
rows instead of re-rendering, for the same scroll reason.

**Both lines are highlighted.** With a five-column filter, `정자` or `과천` matching rows with
nothing marked on any of them reads as a broken filter. It costs two `indexOf` scans over ≤44
characters per row, and only on the rebuild path.

**No Expand all.** The trail button exists because a trail's full name is nowhere else in the UI.
A point's full detail is one row click away in `popupContent`, the canonical rendering of exactly
those columns, shared by 2D and 3D. A second unclamping mechanism for text a popup already shows
in full would cost a per-row `Set`, a header button and a relayout of 272 rows — and of the whole
panel's height — on one click. The 지점번호 line is fixed-width and never overflows; the detail
line is ellipsised and carries the full text as a `title`. The header is therefore
`[checkbox] National Points (n)` with nothing on the right, which also keeps the block from
reading as a second Trails block.

**Escape is handled on `#point-search` itself**, not taught to `ui.ts`'s window listener, and
`stopPropagation` fires only when there was text to clear — so a second, empty press falls
through and closes the drawer exactly as it does from the trail filter. `ui.ts` learns nothing
about a second input.

### `src/ui.ts` — smaller, not bigger

`onPointsChange`, the `pointsToggle` field and its listener are gone; `applySettings` keeps only
the basemap radio; `highlightName` moved to `listUi.ts`; the master-checkbox block and the count
ternary each became one call. `renderTrails` behaves exactly as it did.

### `src/scene3d.ts`

`pointsGeoJson` puts `code` in the feature properties beside `index` and `named`. `pointsFilter`
joins `visibleFilter`, phrased as "not in the hidden set" rather than "in the shown list": the
hidden set is empty in the usual case, and the filter is then built from the set alone and never
needs the points. `['in', x, ['literal', []]]` is false, so an empty set draws all of them.

### `src/view3d.ts`

`Scene.showPoints` became `hiddenPoints: ReadonlySet<string>` — the live set `main.ts` owns, never
a copy. `setPointsVisible(show)` became `syncPoints()`, re-reading `getScene()`, which is the
shape `syncTrails` already has, so `main.ts` has one `view3d?.syncPoints()` in the one place point
visibility changes.

A **filter**, not a rebuilt source. `setData` would re-upload 272 features to say one thing, and —
the reason it had to be a filter — a filtered-out feature keeps its position, so the `index`
`pointAt()` reads back into `points` stays valid whatever the list hides.

`pointsShown()` is deleted. With a filter there is no global off switch, and
`queryRenderedFeatures` already excludes filtered-out features, so the guard in `pointAt()` was
dead — and `aimedPoint`, `syncAim`, the orbit click and the cursor `mouseenter` all go through it
or through the layer, so they needed nothing. `openNearby()` is the one place points are walked
directly rather than queried off the map, and so the one place the hidden set is asked about by
hand; the cheap distance test stays first. `opened` deliberately keeps a point that was hidden
while its auto-popup was open: re-showing it while you stand there should not re-pop it until you
are `NEARBY_RELEASE` away, which is what that Set is for.

`popupPoint` is tracked in `openPopup`/`closePopup`, so `syncPoints` can close a popup whose pin
has gone — the same rule as 2D, and the same reasoning as `setVisible` clearing a halo that would
otherwise trace nothing.

`panTo`'s body is hoisted out of the returned object into `goTo(lat, lon)`, and the new
`showPoint(point)` reuses it: a row click lands you exactly where following would — orbit pans,
walking jumps, and a long jump descends from above so the terrain has a moment to load.

### `src/main.ts`

`points`, `pointByCode`, `pointRows(points)` and `hiddenPoints` are set up at the top of `main()`;
the layer is added unconditionally and then synced. `openPoint`/`closePointPopup` are the only
writers of `pointPopup` and `popupPoint`, and `clearMapSelection` uses the latter.

`setPointsHidden(codes, hidden)` is the single place a point's visibility changes. It takes many
codes rather than one so the master checkbox costs one `saveSettings` and one `setFilter` instead
of 272 of each — the same reason `setVisible` refuses to rewrite a record that already agrees.
The re-render sits *outside* the changed guard: the browser has already flipped the checkbox that
was clicked, so the rows have to be re-read from the hidden set either way. `syncPoints()` fans
out to the 2D group, the popup and 3D.

The row-click callback goes to the point without turning it on — like a trail row, which zooms to
a hidden trail without showing it — and selects nothing, because a point is not a trail and a
selected trail should survive. The popup is placed by coordinate rather than bound to the marker,
so it reads the same whether the pin is drawn or not. `POINT_ZOOM` is 17, floored by the current
zoom so a click never zooms *out* and capped at the basemap's `maxZoom` for the reason `close3d`
already gives. It closes the drawer, which a trail row does not: the drawer covers most of a
phone screen and the popup is the whole payload of the click, where a trail row's zoom survives
being looked at later.

### `index.html`, `src/style.css`

The `#points-toggle` section is gone; the new `.block.grow-block` sits after Trails, with a
comment saying why it is last. `lang="ko"` on the `<ul>`, for the font-fallback reason
`popupContent` gives. The placeholder is "Filter by number, name or place" and not "by name" —
the whole point is that it matches five columns. The heading is wrapped in `<label for>`, the
affordance `2026-09-13-10` added for Trails.

CSS adds selectors to existing rules rather than duplicating declarations: `.point-swatch` to
`.trail-swatch` (plus `border-radius: 50%`, so a swatch reads as the round pin it stands for
rather than as a trail's line), `#point-search` to both `#trail-search` rules, `#point-list li` to
the row, `:last-child` and hover rules, and both lists to the `mark` rule. `#trail-list
li.selected` stays trails-only — there is no selection here. `.point-code` is **reused** from the
popup: it is unscoped, and a 272-row column of eight-digit codes wants its tabular figures even
more than one popup line does; its comment now says it is shared. `#point-list .point-code` adds
the row's weight and clamp, and `.point-detail` is new beside `.trail-stats`. The coarse-pointer
block extends its existing selector lists. The "one scroller" comment gains the clause that the
block's placement is what keeps it true.

### Untouched

- `src/nationalPoint.ts` — `NationalPoint` already carried every column the row and the filter
  need, and `parseNationalPoints`'s dedup is why `code` can be a key at all.
- `popupContent` — it already renders all four columns in full. The detail line is a one-line
  restatement of the same fields and deliberately does not try to replace it; it is why this list
  needs no Expand all.
- `renderTrails` behaviour, the `trails` object store, `TrailRecord`.
- `src/selection.ts`, `src/trailPlayback.ts`, `src/firstPerson.ts`, `src/hud3d.ts`,
  `src/walkControls.ts`, `src/map.ts`, `src/basemaps.ts` — points are not theirs.

## Verification

1. `npm run build` — `tsc --noEmit` and `vite build` both pass. The `Settings` rename was
   load-bearing: every `showPoints` reader had to fail to compile until it was updated, and
   `noUnusedLocals` would have caught a `pointsShown` left behind.
2. **`pointRows()` under Node against the real file.** 272 rows, 144 amber, 272 unique codes; no
   `detail` with a leading or trailing space, a doubled `·`, or no content at all; every
   `haystack` contains its own 지점번호; 0 rows whose `detail` is not already NFC, so the
   normalise is inert today, as intended. Longest detail is 44 characters —
   `G50 학바위능선 아래 삼거리 · 국가지점번호판(전용지주) · 서울특별시 관악구`.
3. **Filter semantics under Node**, through the real `searchTokens`/`matchesFolded`:
   과천 49, 금천 30, `안양 만안` 13, `안양 동안` 12, 정자 9, 가로등 2, `다사52414090` 1,
   `다사524` 6, gibberish 0, an empty query 272. Two results are worth recording because they
   are *not* the region counts and should not be: **관악 gives 171, not the 168 rows filed under
   관악구** — 관악산입구, 관악문 아래사거리 and 관악사지~삼거리 are filed under 과천시 but are
   named for the mountain, which is exactly what a five-column filter is for. And **`관악 정자`
   gives 0**, which is the true token-AND intersection: all 9 정자 are in 금천구.
4. **`PointsList` under a DOM stub.** Boot emits 272 rows, all checked, master checked and not
   indeterminate, each row carrying its code, its pin colour, `Show <code> on map` and the full
   detail as a `title`. Hiding one point leaves the `<li>` nodes identical — no rebuild — and
   turns the master indeterminate; hiding all leaves them identical too and unchecks it. Typing
   `과천` does rebuild, to 49 rows and `(49 of 272)`, and clicking the master then reports exactly
   those 49. `<mark>`s appear on the detail line for `위치안내` and on the code line for `다사`.
   A query matching nothing leaves the list empty and the message right while keeping the search
   box — its own escape hatch — and hides the master. Escape in the filter clears it, stops the
   event once, and does not stop the second, empty press. A row click selects; a click on its
   checkbox does not, and the checkbox toggles instead.
5. **`pointsFilter` evaluated against the real features.** Every `properties.index` still equals
   the point's position in `loadNationalPoints()` and every `code` its point's — the whole reason
   for a filter rather than dropped features. An empty hidden set passes all 272, one code drops
   exactly one, and the full set drops all of them.
6. **`npm run dev`, 2D.** Uncheck one row → that pin alone goes, master indeterminate, panel does
   not scroll, and focus stays on the checkbox (press Space, then Tab, and focus lands on the next
   row). Disable all → 272 pins gone, one `saveSettings` — DevTools → IndexedDB shows a single
   `hiddenPoints` array of 272 — and the state survives a reload; re-enable all empties the array.
   Open a pin's popup, then uncheck that point → the popup closes; uncheck a different one → it
   stays. Filter to 과천 and click the master → only those 49 move. Click a row → the map goes to
   z17, or stays closer, and the popup opens; a row whose checkbox is off still opens its popup
   with no pin under it. On a phone the drawer closes and the popup is visible.
7. **`npm run dev`, 3D.** Points hidden in 2D are missing in 3D; hide one while 3D is open and it
   goes there too. Aim the crosshair at a hidden point while walking → the crosshair does not
   light and a tap does nothing. Walk within 25 m of a hidden point → no popup; re-check it, walk
   past 40 m and back → it opens. Click a row while 3D is open → orbit pans and opens the popup,
   walking jumps you there. Hide the point whose 3D popup is open → it closes. Switch basemap with
   points hidden → `setBasemap` re-adds only `LAYER_BASEMAP`, so the filter survives.
8. **Migration.** A browser whose record still has `showPoints: false` loads with every pin
   visible and no `hiddenPoints` key until the first change, after which the record has
   `hiddenPoints` and no `showPoints`. A fresh browser shows all of them.
9. **Keyboard and reading order.** Tab from the trail filter reaches the points master, the points
   filter, then the row checkboxes. Escape in the points filter clears it without closing the
   drawer; a second press closes the drawer. The heading label toggles the master.
10. **Layout.** Desktop and 390×844: `.panel-body` is still the only scroller — scroll to the
    bottom of 272 rows and there is no nested scroll region — Trails is always reachable above,
    the 20px checkboxes and 16px filter font apply on coarse pointers, and the detail line
    ellipsises rather than wrapping.
