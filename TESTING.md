# Verification record — 2026-10-09

## Automated checks completed

`npm test` passed all 17 tests under Node.js 24.19.0.

- Platform-specific username formats and lengths; case normalization;
  display-name-like input, legacy Discord tags and consecutive periods.
- Minecraft exact name/UUID matches; absent, released, locked and reserved
  **synthetic fixtures** remain Unknown. No fabricated real restricted name
  is presented as confirmed. Wrong UUIDs, foreign/duplicate profiles and
  malformed bulk responses fail closed.
- Explicit sourced restriction evidence is Restricted/Reserved while valid;
  malformed or expired evidence falls back to Unknown. This verifies trusted
  operator evidence handling, not automatic discovery of hidden Mojang locks.
- Exact TikTok/Snapchat profile data confirms Taken; generic HTML, echoed URLs,
  mismatching usernames and 404s do not. Unsupported Discord availability and
  disputed TikTok lengths remain Unknown.
- Cache TTLs and original observation timestamps; transport/5xx/malformed
  failures never yield availability and do not populate availability cache.
- Manual Unknown retry refresh with retained Taken cache observations; dynamic
  cooldown changes rechecked before request admission.
- Numeric/date Retry-After, short-window bounded retries, long-window cooldown
  circuit, 401/403 stop behavior, opaque pages, exponential retry backoff.
- Active upstream cancellation, pacing cancellation and prompt cancellation
  while waiting behind another request; HTTP disconnect cancels server work.
- Bounded response bodies, route allowlisting, cross-origin rejection, request
  validation, limits, NDJSON event order and asset/CSP delivery.
- Generator deduplication, 2–32-character support, finite search exhaustion,
  contradictory filters, yielding and cancellation.
- Restored pause/resume holds a completed batch and prevents the next batch
  until resumed; per-search control IDs are required.
- DOM interaction tests: 2,000 default; slider/exact numeric synchronization;
  social limit adaptation; 10,000-name run; 50 rendered rows; pagination,
  status/name filtering, keyboard tabs, safe rendering of script-shaped input,
  list deduplication, cancel/re-enable behavior, theme toggle and original reset.
  The original stylesheet is preserved as the base, and the logo is restored
  byte-for-byte from the attachment. Browser visual QA remains blocked as below.

The 10,000-name synthetic UI run completed in approximately 151 ms in jsdom on
one run, with 50 result rows. This measures application/DOM logic, **not browser
paint performance or live network search speed**. The local-only 10,000-name
server run took approximately 24 ms on the same run.

## Live checks completed

Production adapters returned Taken for Notch (Minecraft), `tiktok` (TikTok), and
`teamsnapchat` (Snapchat). A missing Minecraft candidate returned Unknown.
The authenticated Minecraft availability endpoint returned HTTP 401 without a
token. These live observations corroborate positive parsers and the credential
limitation; they do not prove any absent username is claimable.

## Browser visual and mobile verification: blocked

A reproducible Playwright suite is included at `test-support/browser.mjs`, but it
was **not completed** here. The standard Chromium download failed; a Chromium
package from npm could not launch in the workspace process environment. The
remote browser rejected the workspace server address with `ERR_BLOCKED_BY_CLIENT`.
No screenshots or browser performance claims have been fabricated.

Run `npx playwright install chromium` then `npm run test:browser` in a normal
local environment. The script checks desktop/mobile layouts, horizontal overflow,
reduced-motion computed styles, browser errors, worker-based generation, 10,000
results, pagination, filtering, CSV download, keyboard tabs and safe text.
Browser contrast/layout/accessibility QA should be completed before public launch.

## Scope and remaining limits

This is a working Node application, not a public deployment. Provider HTML schemas
can change; unrecognized responses remain Unknown. No current unauthenticated
provider can affirm actual claimability. Hidden Minecraft name locks cannot be
reliably discovered through the public UUID registry. Discord availability is
unsupported through its documented public API. Run a single server instance for
global in-memory rate control; coordinate rates centrally before scaling out.
