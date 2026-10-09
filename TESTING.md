# Verification record — 2026-10-09

## Automated checks completed

`npm test` passed all 22 tests under Node.js 24.19.0.

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
  mismatching usernames and 404s do not. Disputed TikTok lengths remain Unknown. Discord explicit boolean responses,
  restriction errors, invalid formats, schema changes and challenges are covered.
  Available caching expires after 15 seconds; manual refresh rechecks it. JSON
  retry_after and exhausted rate-limit headers pace the shared Discord gate.
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
- Current DOM interaction tests verify Minecraft default selection, exactly one
  radio selected across every service change, four local real-logo assets,
  removal of added panels/tabs, original copy-card markup, available-only grid
  and CSV export, exclusion of every other status, 10,000 synthetic Available
  **test fixtures** rendered in pages of 50, an honest empty state for unknown
  results, cancellation, theme toggling and original reset behavior.
- HTTP tests reject multi-service requests and serve the Minecraft PNG and three social SVG assets.

Synthetic Available fixtures exercise rendering and export only. They are never
used by production adapters and are not evidence of live claimability. Browser
painting, visual layout and mobile accessibility remain unverified here.

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
local environment. The script checks the original interface, service selection, real icons,
available-only results, paging, unknown exclusion and desktop/mobile screenshots.
Browser contrast/layout/accessibility QA should be completed before public launch.

## Scope and remaining limits

This is a working Node application, not a public deployment. Provider HTML schemas
can change; unrecognized responses remain Unknown. Discord reports availability through its public signup check; its undocumented
endpoint can change and final claiming remains platform/account dependent. Hidden Minecraft name locks cannot be
reliably discovered through the public UUID registry. TikTok and Snapchat public profile absence does not establish availability.
The old Snapchat signup endpoint returned 404; TikTok’s session-based availability
endpoint returned an empty HTTP 200 without authentication. Run a single server instance for
global in-memory rate control; coordinate rates centrally before scaling out.

Follow-up production Discord live checks returned Taken for `nova`, Available
for a random test candidate, and Restricted/Reserved for `discordtest` (explicit
USERNAME_INVALID_CONTAINS). The Minecraft wordmark was replaced with a locally
served public-domain grass-block image, inspected at its actual 256px resolution.
No additional browser visual verification was claimed.

## Cooldown and interrupted-search correction

Three additional engine regression tests cover full 90-second cooldown recovery
with a simulated clock (including conflicting header/body windows), retrying the
same name before the next one, cancellation during waiting, pause before retry,
and stopping an access-blocked run without emitting fabricated checked results.
Unsupported TikTok/Snapchat bulk scans emit an immediate error without HTTP calls.
DOM checks additionally cover the live countdown text, Stop, resuming only
unfinished names, and rejecting unsupported social searches before generation.
All 22 tests passed. Simulated cooldown recovery is explicitly not a claim that a
production IP cannot be rate limited; Discord controls the actual retry window.

A live three-name Discord bulk run completed with Taken, Available, and
Restricted/Reserved results followed by done. This confirms the streaming bulk
path on this workspace IP; the long-throttle recovery was tested with fixtures.
