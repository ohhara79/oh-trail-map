# Show the author at the end of the panel

## Context

`data/name.txt` (`Taeho Oh`), `data/email.txt` (`ohhara@postech.edu`) and
`data/homepage.txt` (`http://ohhara.sarang.net`) are new data files, like
`data/title.txt`. They should appear at the very end of the hamburger (☰) panel,
`#sidebar` in `index.html`, below the National Points section.

## Change

1. **`index.html`**: after the National Points `<section>`, as the last child of
   `#panel-body`, add a small footer block:
   ```html
   <footer id="about" class="block about" hidden>
     <p id="about-name"></p>
     <p><a id="about-email"></a></p>
     <p><a id="about-homepage" target="_blank" rel="noopener"></a></p>
   </footer>
   ```
   Inside the one scroller (`.panel-body`), so it is literally the end of the menu,
   after the 272 point rows. Update the "Last, …" comment above National Points to
   say it is the last list, with only the author footer after it.
2. **`src/main.ts`**: next to `applyTitle()` (`src/main.ts:51`):
   - `import rawName from '../data/name.txt?raw'`, and the same for `email.txt`
     and `homepage.txt` (bundled, same reason as `title.txt`).
   - `applyAbout()`, called right after `applyTitle()` in `main()` (`src/main.ts:97`):
     trims each file; sets the name's text; sets the email link's text and
     `href="mailto:…"`; sets the homepage link's text and `href`. A line whose file
     is empty is hidden (its `<p>` gets `hidden`); the footer stays hidden when all
     three are empty.
3. **`src/style.css`**: next to `.hint` (`src/style.css:81`), a muted small-type
   style for `.about` (12px, `var(--muted)`, `p` margins 0 with a little gap,
   links `var(--accent)`, `overflow-wrap: anywhere` so a long URL never widens a
   320px drawer). The existing `.block:last-child { border-bottom: 0 }` already
   applies to it.
4. **`README.md`**: a Features line after the `data/title.txt` one:
   `data/name.txt`, `data/email.txt`, `data/homepage.txt` are shown at the end of
   the panel; an empty file drops its line.

## Files

| File | Change |
|---|---|
| `index.html` | `#about` footer at the end of `#panel-body` |
| `src/main.ts` | Import the three files, `applyAbout()` |
| `src/style.css` | `.about` styles |
| `README.md` | Features line |

## Verification

1. `npm run build`: typecheck and build pass; `ohhara@postech.edu` is in the main bundle.
2. `npm run dev`, desktop width: scroll the panel to the bottom; below National
   Points read `Taeho Oh`, a mailto link, and the homepage link opening in a new tab.
3. Phone width: open ☰, scroll to the end; the footer shows, nothing overflows
   sideways, and it clears the bottom safe area.
4. Empty `data/email.txt` temporarily: only that line disappears; empty all three:
   no footer and no stray border.
