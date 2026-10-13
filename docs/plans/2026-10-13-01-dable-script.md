# Dable script

## Context

With the meta tags from `2026-10-12-01-dable-meta-tags.md` in place, the next
step is Dable's log collection script. It loads
`static.dable.io/dist/plugin.min.js`, names the service, and sends one page-view
log. Without it Dable sees the crawled meta tags but no visits, so nothing can be
recommended from or to the page.

Dable's guide (dashboard → 로그 수집 스크립트) says to put the script where it
runs on every page, next to where Google Analytics would go. It says `<header>`,
but GA goes in `<head>`, and this app's two `<header>` elements are visible parts
of the side panel. The app has one page, so `<head>` covers every page.

The guide's snippet has `'<%= service.service_name %>'` in `setService`: a
server-side placeholder the dashboard did not fill in. The guide also says the
service name can differ from the site's URL, and that a made-up one breaks the
service.

## Change

1. `index.html`: paste Dable's snippet, between its `Dable 스크립트 시작` and
   `Dable 스크립트 종료` comments, at the end of `<head>`, after `<title>`. It is
   kept as Dable wrote it:
   - an inline loader that defines a queueing `window.dable` and inserts the
     async `//static.dable.io/dist/plugin.min.js` script before the first script
     on the page, doing nothing if `dable.q` already exists;
   - `dable('setService', 'gwanaksan.ohhara.ai')`;
   - `dable('sendLogOnce')`.
2. The service name is a plain string, with the `<%= … %>` placeholder replaced
   whole. Vite does not run EJS, so leaving the delimiters in would send them to
   Dable as part of the name. `gwanaksan.ohhara.ai` is the site's host, the same
   as `url` in `data/meta.json`; check it against the service name registered in
   the Dable dashboard.
3. No widget yet. The `<div id="dablewidget_…">` placement comes later, once a
   widget is made in the Dable admin.

## Verification

1. `npm run build` passes, and `dist/index.html` has the snippet inside `<head>`,
   alongside the meta tags the `dableMeta()` plugin adds, with `setService` set
   to `'gwanaksan.ohhara.ai'` and no `<%=`.
2. `npm run dev`, then in DevTools → Network: `plugin.min.js` loads from
   `static.dable.io`, and one log request goes to Dable on load and no more.
3. The map, panel and `#collapse` button work as before; the console shows no new
   errors.
4. After deploying, the visit shows up in real time on Dable's 로그 현황 page.

## Follow-up

- If the service name in the Dable dashboard is not `gwanaksan.ohhara.ai`, change
  `setService` to match it exactly.
- Add the widget `<div>` and its `dable('renderWidget', …)` call when there is a
  widget ID.
