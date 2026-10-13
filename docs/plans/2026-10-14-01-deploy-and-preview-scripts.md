# Add the deploy and preview scripts

## Context

Building, previewing and deploying the site are done by hand: `npm run build`,
then `npm run preview` to check the result, then one `aws s3` command per file
to upload `dist/` to the `gwanaksan-ohhara-ai` bucket. Each kind of file needs a
different `Cache-Control`, so the upload is easy to get wrong. Two short scripts
at the repo root make both steps one command, and committing them keeps the
cache rules in version control next to the files they apply to.

## Change

1. **`r.sh`** (run): build, then serve `dist/` with `vite preview`. `&&` stops
   on a failed build so a stale `dist/` is never previewed. `vite.config.ts:105`
   already binds the LAN address on port 4173, so a phone can open it.

   ```bash
   #!/bin/bash

   npm run build && npm run preview
   ```

2. **`d.sh`** (deploy): build, then upload to `s3://gwanaksan-ohhara-ai` with a
   cache rule per kind of file:
   - `dist/assets/` — `aws s3 sync --delete`, `public,max-age=31536000,immutable`.
     Vite hashes these file names, so a new build never reuses a URL.
   - `og.png`, `favicon.ico`, `icon.svg`, `apple-touch-icon.png` — one week.
     `icon.svg` gets `--content-type "image/svg+xml"` so S3 does not guess it.
   - `robots.txt` — one day.
   - `index.html` — `no-cache`, uploaded **last**, so it never points at assets
     that are not there yet, and browsers pick up a release right away.
   - `dist/data` tiles — a one-week `sync` line, left commented out. The tiles
     are large and rarely change; uncomment it for a deploy that changes them.

3. `chmod +x` both scripts so git records mode 100755.

4. Save this plan as `docs/plans/2026-10-14-01-deploy-and-preview-scripts.md`.

## Verification

1. `./r.sh` builds and serves on http://localhost:4173; the map loads.
2. `./d.sh` builds and uploads without errors.
3. `curl -I` on the site shows `cache-control: no-cache` for `/`, the immutable
   rule for a file under `/assets/`, and `content-type: image/svg+xml` for
   `/icon.svg`.
4. `git ls-files -s d.sh r.sh` shows mode 100755 for both.
