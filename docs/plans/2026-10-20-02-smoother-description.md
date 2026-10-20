# Smooth out the description's last sentence

## Context

`2026-10-20-01-longer-description.md` added a third sentence to
`data/meta.json`'s description:

> GPX를 기반으로 관악산의 다양한 등산로, 등산 지도, 등산 코스, 산행 지도,
> 산행 코스, 트레일 지도, 트레일 코스를 정밀하게 2D/3D로 살펴볼 수 있습니다.

It reads awkwardly. "정밀하게 2D/3D로" comes after a list of seven nouns, so by
the time readers reach it they have lost track of what it describes. The
sentence is also the first text a visitor reads in the panel, through `#intro`.
"GPX를 기반으로" also says only that GPX is the file format, not that the tracks
were actually walked and recorded, which is what sets the map apart.

The search words in the list stay. They are why the sentence was added.

This is a data change only.

## Change

1. **Reword the third sentence of `description`** in `data/meta.json`:

   > GPX 기록을 바탕으로 2D/3D로 정밀하게 관악산의 다양한 등산로, 등산 지도,
   > 등산 코스, 산행 지도, 산행 코스, 트레일 지도, 트레일 코스를 살펴볼 수
   > 있습니다.

   - "GPX를 기반으로" → "GPX 기록을 바탕으로", so it says the tracks are
     recordings.
   - Move "2D/3D로 정밀하게" ahead of the list, so the adverbs come before the
     long object and right after the source.
   - Keep the list of seven phrases unchanged and in the same order.

   The first two sentences and every other key stay byte-identical.
   `dableMeta()` copies the description into `<meta name="description">`
   (`vite.config.ts:108`), `og:description` (`vite.config.ts:96`) and `#intro`
   (`vite.config.ts:119`), so no code changes.

2. **Leave `published_time` at 2026-10-20.** That plan already moved it to
   today.

3. Save this plan as `docs/plans/2026-10-20-02-smoother-description.md`.

## Files

| File | Change |
|---|---|
| `data/meta.json` | `description`'s third sentence reworded |

## Verification

1. Only the description changed: `git diff --stat HEAD -- data/meta.json` shows
   `1 insertion(+), 1 deletion(-)`.
2. The file is still valid JSON, and the list survived:
   `node -e "console.log(require('./data/meta.json').description)"` prints the
   new text, which still contains `등산로, 등산 지도, 등산 코스, 산행 지도, 산행
   코스, 트레일 지도, 트레일 코스`.
3. `npm run build` passes.
4. In `dist/index.html`, `<meta name="description">`, `og:description` and
   `#intro` all carry the new sentence.
5. After deploying with `d.sh`, `curl -s https://gwanaksan.ohhara.ai/ | grep
   description` shows the new text.
