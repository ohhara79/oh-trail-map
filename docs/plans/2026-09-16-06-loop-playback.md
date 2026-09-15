# Loop 3D trail playback

## Context

During 3D playback (▶ on a trail), `Playback.tick()` in `src/trailPlayback.ts` stopped at
the end of the trail on purpose and brought the controls back. The user wants playback to
start again from the beginning and keep playing.

## Change

1. **`src/trailPlayback.ts`**, `Playback`
   - `tick(dt)` wraps past the end to the start and keeps playing:
     `s = (s + WALK_PACE × speed × dt) % total`. `view3d.ts` already refuses paths shorter
     than 2 m, so the modulo never divides by zero, and the extra distance carries over.
   - `toggle()` no longer resets to 0 at the end. A trail never rests at the end while
     playing, and pressing play after a seek to the end wraps on the next tick.
2. **`src/hud3d.ts`**: the `setPlayback` comment no longer mentions the end of the trail.
   Only pausing brings the controls back.

The camera jumps from the end to the start the same way a scrub does. `followYaw` then
eases round to the new direction, as it does after a seek.

## Verification

1. `npm run build` passes.
2. `npm run dev` → select a short trail → ▶ in 3D at 50×:
   - At the end, the view jumps to the start and keeps playing. The button still shows ❚❚,
     and the controls stay hidden.
   - The distance label goes back to `0 m / total`, and the scrubber goes back to the left.
   - Pause and play still work.
