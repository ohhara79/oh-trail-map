# Allow all crawlers with robots.txt

## Context

The site has no `robots.txt`. Crawlers already treat a missing file as "allow
all", but the S3 bucket answers missing objects with a 403 instead of a 404, and
some crawlers read that less clearly than Google does. An explicit allow-all file
makes the intent unambiguous.

## Change

1. Add `public/robots.txt`. Vite copies it into `dist/` on build, the same way it
   copies `public/og.png`:

   ```
   User-agent: *
   Allow: /
   ```

2. `d.sh` (untracked) uploads files by name, so add a line after the `og.png`
   upload:

   ```sh
   aws s3 cp dist/robots.txt $B/robots.txt --cache-control "public,max-age=86400"
   ```

   A one-day cache, since crawlers re-read it often and it rarely changes.

3. Save this plan as `docs/plans/2026-10-13-03-allow-all-crawlers.md`, following
   the repo's plan convention.

## Verification

1. `npm run build` passes and `dist/robots.txt` holds the two lines above.
2. After deploying with `d.sh`, `curl -i https://<site>/robots.txt` returns 200
   with that body.
