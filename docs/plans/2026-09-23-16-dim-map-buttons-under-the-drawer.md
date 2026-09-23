# Dim every map button under the open drawer

## Context

On a small screen (the drawer breakpoint: `max-width: 720px` or
`max-height: 480px`), opening the hamburger menu dims the map with `#backdrop`
(z-index 1050). The zoom and compass controls live inside `#stage` at 1000, so
they went under the dim: greyed and untappable. But the app's own floating
buttons — `#view3d`, `#locate`, `#compass`, `#attitude3d` — sit at 1100 (to beat
Leaflet's 1000 control panes), so they stayed above it, lit and tappable. The
user wants them all to behave the same.

All disabled rather than all enabled: on a phone the drawer is modal — it covers
the map, and a tap outside it means "close the drawer". A tap that turned on 3D
or location instead would change the map behind a panel still in use. Lifting
the map libraries' control containers over the dim would also fight their own
stacking.

## Change

1. **`src/style.css`** — inside the drawer media query, `#backdrop` goes to
   z-index 1150 and `#sidebar` to 1160: over the 1100 buttons, still under
   `#notices` (1200). Scoped to the query, so desktop stacking is unchanged.
2. Update the `#backdrop` and `.hud-bar` comments to the new numbers.

`#expand` is `display: none` while the panel is open, so it is unaffected.

## Verification

1. `npm run build` passes.
2. At a phone size (390×844) open the menu: zoom, compass, 3D and location are
   all dimmed, and tapping any of them only closes the drawer.
3. Same at a landscape phone size (844×390), and with 3D on.
4. A notice raised with the drawer open still shows above it.
5. At desktop width, the panel and buttons behave as before.
