# A tap hides the playback controls, and nothing else does

## Context

During 3D playback the controls over the scene faded out on their own after 3 s
(`docs/plans/2026-09-15-08-auto-hide-playback-controls.md`). The user wants to see the
UI while a trail plays, and the auto-hide was in the way twice over:

1. **The UI left again as soon as it came back.** The private `reveal()` re-armed the
   timer, so controls brought back by a click faded out three seconds later. This was
   the one that bit every time.
2. **And the tap could miss the toggle altogether.** `onSceneTap` (`src/view3d.ts:583`)
   ran its aim-picks first and only fell through to `hud.tap()` last. The trail playing
   is normally the selected one and `aimedTrail()` skips that — but a crossing trail
   within reach is not skipped, and this map has plenty: the tap was then spent on
   `opts.onSelect(trail)`, where the selection bar is hidden anyway, so nothing
   happened at all. A ball in the crosshair ate the tap the same way.

Decided with the user: **remove the auto-hide entirely** — the 3 s fade after a tap and
the one when playback starts alike. Playback opens with the controls showing, and from
then on nothing but a tap on the scene changes that: a tap hides them, a tap brings them
back. Alongside that:

- **While the controls are hidden, a tap only brings them back** — it picks and clears
  nothing behind them, the way a phone video player behaves. Point popups are still
  reachable in playback with a second tap, once the controls show.
- **No trail picks during playback.** A tap there is for the controls.
- **Mouse capture is unchanged**: every scene click still captures the mouse, and Esc
  still frees it and brings the controls back.

Since only a tap moves them, pausing no longer forces the controls up either: if you
hid them and press Space, they stay hidden. Plan 08 stays as the record of what this
replaces.

## Change

The hide state still lives in `src/hud3d.ts` and is published as `data-chrome` on
`#app`; `src/style.css` already reads it and keeps the 0.25 s fade, which is now the
transition of a tap rather than of a timer. No markup change.

### `src/hud3d.ts` — delete the timer, keep the toggle

1. Deleted `HIDE_DELAY` and the `hideTimer` field.
2. Deleted the keep-alive `pointerdown`/`input` listeners on `#app`: with no timer there
   is nothing to keep alive. The scrubber's own `input`/`change` listeners stay.
3. Deleted `scheduleHide()`, and with it the `matchMedia('(hover: hover)')` hover hold.
   `seeking` stays; `setPlayback` still reads it so playback does not drag the scrubber
   out from under you.
4. Deleted the `playing` field, the line resetting it in `setMode`, and the
   `if (state.playing !== this.playing) { … }` block at the top of `setPlayback`.
   Nothing else read it, and `noUnusedLocals` would flag it. The rest of `setPlayback` —
   the ▶/❚❚ label, speed, name, distance and scrub value — is unchanged.
5. `setMode`: dropped the `scheduleHide()` for the trail-started-while-playing case. The
   `show()` stays, so entering playback, or starting another trail while one plays,
   opens with the controls up.
6. `tap()` and the private `reveal()` are replaced by the two halves the scene calls:
   - `reveal(): boolean` — false unless in playback with `data-chrome='hidden'`;
     otherwise `show()` and true, so the tap is spent and the ghost click swallowed.
   - `dismiss(): void` — `hide()` in playback, nothing elsewhere.
7. `show()` and `hide()` lost their `clearTimeout` lines. `hide()` still blurs a focused
   control, so Space reaches `onSpace` rather than a hidden button.
8. `pointerlockchange` calls `reveal()` — the public one now; the cursor is back, so the
   controls should be.
9. The file-header comment now describes a tap, not a timer.

### `src/view3d.ts`

10. `onSceneTap`, three edits:
    - `if (hud.reveal()) return true;` first: with the controls hidden, the tap only
      brings them back and picks nothing out from behind them.
    - The `aimedTrail()` branch is wrapped in `if (mode === 'walk')`. The selection bar
      it would show is hidden during playback, walking the trail playing keeps it under
      the crosshair, and it is the branch that ate the tap. It also saves a
      `queryRenderedFeatures` per tap there. Points stay pickable — a popup is not part
      of `CHROME`, and opening one while a trail plays is deliberate
      (`docs/plans/2026-09-16-05-open-nearby-points-during-playback.md`).
    - `return hud.tap();` became `hud.dismiss(); return false;`. `false` is what the old
      hide branch returned, so `swallowNextClick()` and the unconditional
      `captureMouse()` in `src/walkControls.ts` behave exactly as before.

### `src/style.css`

11. Comments only: the `data-chrome` rules and their reduced-motion twin no longer
    describe an auto-hide. The rules themselves are unchanged.

### `README.md`

12. The playback sub-bullet: the buttons stay up, a tap or click puts them away and
    another brings them back, a tap with them hidden only brings them back, Esc frees a
    captured mouse and brings them back too, and aiming at a trail picks it while
    walking, not while one plays.

## Verification

1. `npm run build` passes — the type check catches the old `hud.tap()` caller and any
   leftover reference to the deleted members.
2. `npm run preview`, desktop Chrome, 3D → a trail row's ▶:
   - **Nothing fades on its own.** ☰, 3D, locate, the attitude disc, the mode bar and
     the playback bar are up when playback starts and still up minutes later.
   - **A tap hides them.** Click the scene away from any ball: they fade out and stay
     out. The mouse is captured, as before.
   - **A tap brings them back.** Click the scene anywhere — straight down the trail you
     are walking, and at a point ball: they return and nothing is picked or cleared.
     Esc frees the mouse and they are still up.
   - **Points still work.** Controls up, aim at a ball and click: the popup opens and
     the controls stay. Click again: it closes.
   - **No trail select in playback.** Aim at a crossing trail and click with the
     controls up: it is not highlighted and the panel row does not change (a selection
     dims the other trails through `trailOpacity`, so it would be visible). Esc back to
     walk: no selection bar for it.
   - **Walk is unchanged.** In walk, aiming at a trail or point still picks it.
3. Pause, resume and the scrubber:
   - Space or ❚❚ pauses and ▶ resumes with no effect on whether the controls show:
     hidden stays hidden, shown stays shown.
   - Dragging the scrubber and pressing speed work, and nothing hides under the finger.
   - There is no end-of-trail case — `Playback.tick` wraps with `% path.total`, so a
     trail left playing loops.
   - Switching tabs away and back (playback pauses on `document.hidden`,
     `src/firstPerson.ts`) leaves the controls as they were.
4. **A second trail, and leaving.** With the controls hidden, press another row's ▶:
   `setMode` shows them for the new trail. Esc to walk shows them and walk never hides
   anything; Esc again to orbit likewise.
5. Phone emulation (Pixel 7): a tap toggles the controls from anywhere on the scene, a
   drag to look does not, tapping ▶/❚❚ keeps the bar up, and the joystick never reads as
   a scene tap.
6. With reduced motion emulated, the controls snap instead of fading.

Headless Chrome (SwiftShader) ran items 1–6, except pointer lock, which headless never
grants, so mouse capture and its Esc release are checked by hand.
