# Verification — 2026-10-10

All 36 automated tests passed under Node.js 24. Earlier live observations below are historical; this UI update did not repeat upstream checks.

- Platform formats, boundaries and case normalization for Minecraft, GitLab,
  Last.fm and Discord; reserved GitLab routes/AI prefixes and ambiguous suffixes.
- Strict signup schema validation: booleans must be actual booleans; Last.fm's
  echoed success text with valid:false never becomes Available. Challenges,
  malformed or unfamiliar data fail closed.
- Last.fm ordinary anonymous session retrieval/reuse, correct CSRF cookie/form
  submission, no passwords or authorization headers, caching and missing-token
  or blocked-session handling.
- Minecraft absent, locked and reserved synthetic fixtures remain Unknown;
  sourced expiring operator restrictions are handled separately.
- Rate-limit windows, conflicting Discord header/body values, full 90-second
  simulated cooldown recovery, same-name retry, adaptive pacing, cancellation
  during waiting and pause before retry. A blocked run does not count its tail.
- Timeouts/backoff, body bounds, caching expiry, refresh, gate admission,
  disconnect cancellation, pause/resume and NDJSON stream event order.
- Real local icon assets, original theme and components, Minecraft default,
  exactly one service, removal of TikTok/Snapchat, both replacement services
  submitting checks, available-only grid/export, 10,000 synthetic UI results
  paged at 50, countdown text, stop and unfinished-name resume.

## Live checks completed

The production Last.fm bulk adapter returned Taken for rj and Available for an
unused test candidate, then done. Its anonymous CSRF session was reused.

The production GitLab bulk adapter returned Taken for root, Available for an
unused test candidate and Restricted/Reserved for help, then done.

The production Discord bulk adapter previously returned Taken, Available and
Restricted/Reserved, then done. Real Discord IP throttling still applies; long
cooldown recovery was verified with timed fixtures, not a claim of immunity.

Minecraft returned Taken for Notch and Unknown for a missing candidate. The
actual authenticated availability endpoint returned 401 without credentials.
No absent/locked Minecraft username was falsely shown as available.

The service icon now uses the latest user attachment, image(20261010-113801).png, optimized to a 56×56 transparent PNG and embedded in app.js. Tests verify the embedded PNG is under 2,000 bytes and the CSP permits data images. Header icon buttons retain accessible names. The count field is hidden and tests drive the visible slider; removed paragraphs remain absent.
Reddit, Twitch, TikTok and Snapchat did not return usable availability results in
live probes and are not presented as working services.

## Limits

No account was created and no name was claimed or reserved. Live observations
are time-of-check results, not account-specific registration guarantees.

Browser painting/mobile QA remains unverified: the standard Chromium download
failed previously, npm Chromium could not launch, and the remote browser rejected
the workspace server URL. The optional Playwright suite is included for running
in a normal local environment. No fabricated screenshots or browser performance
claims are presented. No public deployment was performed.

2026-10-10: 31 tests pass after the optional-service settings, streamed exhaustive traversal, shared word matcher, static compression/ETag cache, cache batching, two-request Minecraft pipeline and worker integration changes. `tests/improvements.test.js` verifies the full small-space product across budgets, BigInt cursor boundaries, positional/boundary English matching, service-compatible character sets, static HEAD/304 responses, cache chunking, worker secret/schema/batch constraints and overlapping Minecraft requests under one gate. `benchmarks/dom.json` measures synthetic JSDOM interactions and 10,000-result handling; it is not a browser paint benchmark. Raw before/after data in `benchmarks/` preserve the measured evidence and caveats.

Current live probes successfully checked all four service adapters. Playwright remains blocked because Chromium is not installed; no visual screenshot or deployed-worker verification was performed. Worker test fixtures never enter production availability output.

Latest UI revision: 31 tests pass. Optional icon loading, Available-only indexing, bounded 50-card rendering, slider behavior and SVG header buttons are covered. Benchmarks were rerun; see README and benchmarks/after.json. Actual browser paint/visual QA remains unavailable.

Search recovery verification: 36 tests pass. New real-HTTP streaming regressions cover each service recovering from a misconfigured gateway, missing binding diagnostics, 90-second simulated busy/platform cooldown waits, same-batch retry, cancellation, no fallback after blocks/500/502/partial results or an earlier healthy remote run. UI assertions cover the new sliders glyph and 20% artwork transform.

Fresh small live probes on 2026-10-10 returned Discord Taken/Available/Restricted, Minecraft Taken/Unknown, GitLab Taken/Available/Restricted and Last.fm Taken/Available. Minecraft authenticated name availability again returned HTTP 401 without credentials. These observations were made from this environment, not the user's Render or Cloudflare deployment; service behavior from provider IPs can differ.
