# Auto-hide the controls while a trail plays in 3D

## Context

During 3D playback (a trail's ▶), several things sit on top of the scene you are
watching: the ☰ button, the 3D button, the locate button (and the compass on iOS),
the Orbit/Walk/Eye/Gyro bar, and the playback bar. The change is to fade them all
out while the trail plays, and bring them back when you tap the scene.

Decided with the user:
- **A tap toggles.** A tap on the scene while the controls are hidden shows them
  for 3 s. A tap while they show hides them at once, as phone video players do.
- **Desktop.** A click while the controls are hidden only shows them; it does not
  capture the mouse, because a captured mouse could not reach the controls. A
  click while they show hides them and captures the mouse, as today.
- **Pause and play.** The controls hide only while playing. Pausing (or reaching
  the end) brings them back and keeps them up. Play starts the 3 s timer again.
  While paused, a tap can still hide them.
- **Other modes.** Walk and orbit are unchanged. A drag to look around never
  shows or hides anything.

## Change

1. **`src/walkControls.ts`**
   - Add `onTap?: () => boolean` to `ControlsOptions`. It is called on a click or
     tap on the surface (`pointerup`, moved < `CLICK_SLOP`, never on
     `pointercancel`). It returns `true` when the tap only brought the controls
     back.
   - `onPointerUp`: for any pointer type, compute `used = opts.onTap?.() ?? false`
     on a tap. The existing mouse pointer-lock request then also needs `!used`.
     Update the comment to match.

2. **`src/hud3d.ts`**: the `Hud` owns the hide state and writes
   `data-chrome="hidden"` on `#app`. The CSS reads it, the same pattern as
   `data-mode3d`.
   - Add `const HIDE_DELAY = 3000`, plus fields `mode`, `playing`, `hideTimer`.
   - `setMode(mode)`: store it, then `show()`. In playback, the next `setPlayback`
     starts the timer.
   - `setPlayback(state)`: when `state.playing` differs from `this.playing`, update
     it. On play, `scheduleHide()`; on pause or end, `show()`. It is called every
     frame, so it acts only on a change.
   - `tap(): boolean`: return `false` outside playback. If hidden, `show()`, then
     `scheduleHide()` if playing, and return `true`. Otherwise `hide()` and return
     `false`.
   - `show()` / `hide()` / `scheduleHide()`:
     - `show()` clears the timer and deletes the attribute.
     - `hide()` sets the attribute. If the focused element is one of the hidden
       controls, it blurs it, so Space still reaches `onSpace` (walkControls skips
       Space while a button has focus).
     - `scheduleHide()` restarts a `setTimeout`. When it fires, it re-arms instead
       of hiding in three cases: the scrubber is held (`seeking`), a mouse is
       hovering a control, or we are no longer playing.
   - **Keep-alive while you use the controls.** A `pointerdown` or `input` on
     `#app` (with the existing abort signal) whose target is not inside `#map3d`
     restarts the timer when it is running. The effect is that pressing speed,
     scrubbing, or tapping ☰/locate does not hide the bar under your finger.
   - Add `document` `pointerlockchange`: when the mouse is released (Esc) during
     playback, `reveal()` (show, then the timer if playing), so the controls are
     there when the cursor comes back. `tap()` uses the same `reveal()`.
   - `destroy()`: clear the timer and delete `data-chrome`.

3. **`src/view3d.ts`**: pass `onTap: () => hud.tap()` to `createControls` in
   `startWalking` (around `src/view3d.ts:295`).

4. **`src/style.css`**
   - Next to the 3D HUD rules (around `src/style.css:390`):
     ```css
     /* Playback's auto-hide, decided in hud3d.ts. visibility follows the fade, so
        a hidden button can be neither clicked nor tabbed to. */
     #app[data-mode3d] :is(#expand, #compass, #locate, #view3d, #mode3d, #playback3d) {
       transition: opacity .25s ease;
     }
     #app[data-chrome='hidden'] :is(#expand, #compass, #locate, #view3d, #mode3d, #playback3d) {
       opacity: 0; visibility: hidden;
       transition: opacity .25s ease, visibility 0s .25s;
     }
     ```
     Scoped to `data-mode3d`, so 2D is untouched. `#notices` stays visible: notices
     are messages and time out on their own. MapLibre's zoom control and
     `#selection-bar` are already hidden in playback.
   - `prefers-reduced-motion` block: add the same `:is(...)` list under
     `#app[data-mode3d]` with `transition: none`. It has the same specificity and
     comes later in the file, so it wins.

5. **`README.md`**: add a sub-bullet under "▶ on a trail row"
   (`README.md:36`): while playing, the controls fade out after 3 s; a tap or
   click brings them back.

6. **Plan doc**: save this plan as
   `docs/plans/2026-09-15-08-auto-hide-playback-controls.md`.

## Verification

1. `npm run build` passes (type check and bundle).
2. `npm run preview`, desktop window:
   - **Start.** Press a row's ▶. After 3 s, ☰, 3D, locate, the mode bar and the
     playback bar fade out.
   - **Click to show.** Click the scene: the controls return and the mouse is
     **not** captured. Click speed and drag the scrubber: they stay up while you
     use them, and while the mouse hovers them.
   - **Click to hide.** Click the scene while the controls show: they hide and the
     mouse is captured. Esc releases the mouse and the controls return.
   - **Space.** Space pauses: the controls return and stay. Space plays: they hide
     after 3 s, even if the play button was the last thing clicked.
   - **End of trail.** Reaching the end shows the controls.
   - **Leaving playback.** Esc to walk: all controls show, and walk mode never
     auto-hides. Clicking in walk still captures the mouse at once.
   - **Drag.** A drag to look during playback neither shows nor hides.
3. Phone emulation (Pixel 7):
   - A tap toggles the controls, and a drag to look does not.
   - Tapping ▶/❚❚ in the bar works and keeps the bar up.
   - ☰ opens the drawer.
4. With reduced motion emulated, the controls snap instead of fading.

Headless Chrome (SwiftShader) ran items 1–4, except pointer lock, which headless
never grants, so mouse capture and its Esc release are still to check by hand.
Headless also reports no hover-capable pointer: the hover hold was tested with
`matchMedia('(hover: hover)')` stubbed in the page.
