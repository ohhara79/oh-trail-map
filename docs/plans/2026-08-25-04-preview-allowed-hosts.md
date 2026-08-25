# Allow the map.ohhara.io host on the preview and dev servers

## Context

Loading the app at `map.ohhara.io` returned a plain-text refusal instead of the
map:

```
Blocked request. This host ("map.ohhara.io") is not allowed.
To allow this host, add "map.ohhara.io" to `preview.allowedHosts` in vite.config.js.
```

This is Vite's own guard, not a proxy or DNS failure. Since 5.4.12 the dev and
preview servers compare the request's `Host` header against an allowlist and
answer 403 to anything unrecognised. The check exists to close a DNS-rebinding
hole: a dev server bound to `0.0.0.0` is otherwise reachable by any name that
resolves to the machine, including an attacker-controlled domain pointed at a
developer's LAN address, and same-origin rules would then let a page on that
domain read the served source. The default allowlist is localhost and bare IP
literals — deliberately not "whatever the request claims to be".

`vite.config.ts` at that point configured only `server`, from the mobile work in
[`2026-08-25-03-mobile-friendly-layout.md`](2026-08-25-03-mobile-friendly-layout.md),
which added `server.host: true` so a phone on the same Wi-Fi could reach the dev
server. `r.sh` runs `npm run build && npm run preview`, and it is the **preview**
server that fronts `map.ohhara.io`. Preview has its own config block and its own
allowlist; `host: true` binds the interface but says nothing about which names
may address it. So the domain resolved, connected, and was refused at the last
step.

## Approach

### `vite.config.ts` — name the host on both servers

```ts
server:  { port: 5173, host: true, allowedHosts: ['map.ohhara.io'] },
preview: { port: 4173, host: true, allowedHosts: ['map.ohhara.io'] },
```

The preview block mirrors what `server` already expressed rather than inventing
different behaviour for the built app: `host: true` to bind the LAN address, and
the explicit `4173` to pin the port the domain is pointed at, so a future
default change cannot silently move it.

`allowedHosts` is added to `server` as well. Only preview was failing, but the
dev server enforces the identical check, and the same domain aimed at port 5173
would have produced the same error the first time anyone tried it.

Two rejected alternatives, both of which make the error go away and one of which
undoes the fix above it:

- `allowedHosts: true` disables the check outright and restores exactly the
  DNS-rebinding exposure it was added to prevent. It is the top hit for this
  error message and is the wrong answer for a server bound with `host: true`.
- `'.ohhara.io'` — a leading dot means "this domain and all subdomains". It
  would work, and it grants more than this project needs. One exact host is the
  narrower statement of the same intent; the wildcard is there if other
  subdomains ever front the app.

Neither the geolocation caveat nor anything else from the mobile plan changes:
this is a host-header allowlist, not a secure-context question, so
`startLocating` still requires localhost or HTTPS regardless of the domain used.

## Files

| File | Change |
|------|--------|
| `vite.config.ts` | `preview` block (`port`, `host`, `allowedHosts`); `allowedHosts` added to `server`; comment recording why the list exists |

## Verification

The failure is a 403 on a header, so it reproduces without a browser — `curl`
with a forged `Host` is the whole test:

```
curl -s -o /dev/null -w '%{http_code}\n' -H 'Host: map.ohhara.io' http://localhost:4173/
```

- Preview (`npx vite preview`, port 4173): **200** with the `map.ohhara.io`
  header, and 200 for plain `localhost`. Previously 403 with the block message
  as the response body.
- Dev (`npx vite`, port 5173): **200** with the same forged header.
- Banner still reports `Local: http://localhost:4173/` and the LAN address, so
  the added `port`/`host` changed nothing about how the server binds.

One trap cost time while confirming the fix and is worth recording: **the 403
survived the edit.** A Vite server reads its config once at startup, and the
preview process launched earlier by `r.sh` was still holding port 4173, so every
retry hit the old configuration. A fresh server on the same port is what turns
the 403 into a 200 — restart after touching `vite.config.ts`, and check what
already owns the port (`ss -lptn 'sport = :4173'`) before concluding the config
is wrong.

Still worth a real pass: loading `map.ohhara.io` in a browser end-to-end, which
also exercises whatever proxy or DNS sits in front of the port and is the only
check that covers the path the user actually takes.
