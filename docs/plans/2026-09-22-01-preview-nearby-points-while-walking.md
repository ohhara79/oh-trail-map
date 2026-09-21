# Preview a nearby national point's name while walking in 3D

## Context

3D Walk and playback used to open a national point's popup by themselves when you
came within 25 m of a point in view (`openNearby()`). The user found that
confusing, and commit 882e804 (`2026-09-17-08-no-auto-open-points-while-walking`)
removed it. The user now wants a quieter version: show only a **preview**, the
same dark name label the mouse hover shows in 2D and 3D orbit
(`src/hoverLabel.ts`), next to the point's ball. No popup opens.

What a tap does stays the same (the user chose this): it opens or selects whatever
the crosshair aims at. The label only tells you what you're passing.

Performance: the earlier crosshair preview while walking (5a8c6e2, reverted by
`2026-09-17-11-revert-walk-preview`) felt sluggish because it ran
`queryRenderedFeatures` and changed layer filters every frame. This preview doesn't
query the scene. Each frame it runs ~272 `haversine` distance checks (the balls'
own render already does 272 terrain lookups per frame) and projects one point.

## Change

1. **`src/view3d.ts`**
   - Bring back the `NEARBY = 25` constant (metres), with its old comment: trails
     pass within 15–20 m of the points they visit, and points are rarely closer
     than 50 m to each other. `NEARBY_RELEASE` and the `opened` set don't come
     back, because nothing opens now.
   - Add `nearbyPoint(): NationalPoint | undefined`, built from the old
     `openNearby()` loop. Return nothing if `!walker`, `tween` is running, or a
     popup is open (a popup already names the point). Otherwise return the closest
     point within `NEARBY` of `walker.pose` that isn't in `getScene().hiddenPoints`
     and passes `inWalkView(new LngLat(lon, lat))`. Do the distance test first,
     because it's the cheap one.
   - Add `syncNearby()`. Call it from the existing `map.on('render')` handler next
     to `liftPopup()` whenever `mode !== 'orbit'`. It projects the point with
     `ballTop()` (the same projection the popup uses, so the label follows the
     ball you see) and calls `hoverLabel.show(point.name || point.code, x, y)`.
     If there's no point or no projection, it calls `hoverLabel.hide()`.
   - `syncHover()`: when `mode !== 'orbit'`, clear the hover layers and cursor as
     it does now, but leave the label alone, because `syncNearby` owns it while
     walking. Otherwise the rAF'd `scheduleHover()` from `openPopup`,
     `syncPoints` and similar calls would hide it and it would flicker.
   - In `setMode`, going back to orbit: hide the label. The next `syncHover` sets
     it again from the mouse.
   - `openPopup` / `closePopup` / `syncPoints`: call `map.triggerRepaint()`, so a
     still camera redraws and the label hides or reappears at once.
2. **`README.md`** (Walk bullet, next to the aim/tap sentence): add "Walking past
   a national point (within 25 m) shows its name beside its ball, in playback
   too. It opens only when you aim at it and tap."
3. Save this plan as
   `docs/plans/2026-09-22-01-preview-nearby-points-while-walking.md`.

Reuse: `createHoverLabel` / `hoverLabel` (already created in `view3d.ts`),
`ballTop()`, `inWalkView()`, `haversine` (`src/gpx.ts`),
`getScene().hiddenPoints`.

## Verification

1. `npm run build`: typecheck and bundle pass.
2. `npm run dev`, 3D, then Walk near K-numbered points:
   - Walking within 25 m of a point shows its name label beside its ball, with
     no popup. The label follows the ball as you move and look. It hides when
     you walk away, or turn so the point is out of view.
   - Tapping without aiming doesn't open it. Aiming and tapping opens the popup
     and the label hides. Closing the popup brings the label back.
   - With national points turned off in the panel: no label.
   - Playback past points: labels come and go, and playback stays smooth.
   - No label during the flight into Walk. Back in orbit, the label is gone, and
     mouse hover in orbit works as before.
3. Commit the change with the plan doc.
