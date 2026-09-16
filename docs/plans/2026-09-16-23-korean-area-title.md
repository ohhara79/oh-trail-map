# Show the area title in Korean

## Context

`data/title.txt` names the area this copy of the map covers, and `applyTitle()` in
`src/main.ts` shows it after the app name in the tab title and the panel heading:
`oh-trail-map (Gwanaksan Mountain)`. Everything else area-specific in the app is
already Korean — the National Point 이름, 시/도 and 시/군/구 — so the English
romanisation is the odd one out. The title should read `관악산`.

## Change

1. `data/title.txt`: replace `Gwanaksan Mountain` with `관악산`, keeping the file
   UTF-8 with its trailing newline.
2. `README.md`: update the example in Features to `oh-trail-map (관악산)`.

No code change. `applyTitle()` trims the raw text and drops it into
`document.title` and the `h1` as-is, and the file is bundled with `?raw`, which
keeps UTF-8 intact.

## Files

| File | Change |
|---|---|
| `data/title.txt` | `관악산` |
| `README.md` | Example title |

## Verification

1. `npm run build`: the type check and build pass, and `관악산` is in the main
   bundle.
2. `npm run dev`: the tab and the panel heading both read `oh-trail-map (관악산)`.
3. Narrow the panel: the heading still wraps before the bracket, not inside the
   name.
