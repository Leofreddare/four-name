# Four Name

The original Four Name monochrome interface, expanded as a credential-free username explorer for Minecraft Java Edition,
TikTok, Snapchat and Discord. Node.js 22–24; production has no third-party runtime
dependencies. Platform checks run on the server, not through browser CORS workarounds.

## Run

```sh
npm ci
npm start
```

Open http://localhost:3000. Set `PORT` to change the port. `npm ci --omit=dev` is
sufficient for production. The included `render.yaml` starts the Node server;
it is not a static-only site. Nothing has been deployed automatically.

## What the results mean

| Status | Required evidence |
| --- | --- |
| Available | Affirmative evidence of actual availability. **No current public adapter emits this status.** |
| Taken | Matching Minecraft name and UUID, or an exact username in structured public social profile data. |
| Restricted/Reserved | Explicit, sourced, unexpired restriction evidence supplied by the operator. None is bundled. |
| Invalid | Violates supported documented username format rules. |
| Unknown | Unable to verify; includes missing profiles, undocumented availability, throttling, transport failure, opaque pages and uncertain rules. |

**Minecraft fix:** an empty bulk response never means Available. Recently released,
locked, reserved and blocked names without a current profile all remain Unknown.
The public UUID registry does not expose those states. Minecraft Services' actual
name availability endpoint requires a bearer token (live unauthenticated probe
returned 401). This app does not collect one or attempt authentication. Confirm
claimability in your own account on Minecraft.net.

TikTok and Snapchat checks only confirm Taken when a current, exact profile schema
matches. A 200 response, echoed username, missing page, display name, privacy block
or challenge page is insufficient. Schema drift fails closed to Unknown.
Discord's documented API has no public unique-username availability operation.
An undocumented signup probe used by Sherlock was reviewed and deliberately not
used as an availability guarantee; Discord checks format and returns Unknown.

TikTok's official help specifies allowed characters and no trailing period, but
not a definitive length range. Generation uses the common 2–24 range; list input
outside that range returns Unknown rather than asserting Invalid. Snapchat's
phone-number and content-policy restrictions cannot be exhaustively decided
locally; matching the character format is not a claimability guarantee. Minecraft
checks Java profile names, not Bedrock/Xbox gamertags. No display-name availability
is implied for any platform.

## Search and reliability

- 2,000 names by default. Exact integer input (1–10,000) and a graduated effort
  slider. TikTok/Snapchat cap the entire selected search at 2,000 names;
  Minecraft/Discord permit 10,000. Slider values adapt to those limits.
- Worker-based candidate generation with a yielding fallback. Original prefix,
  suffix, contains, character exclusion, pattern, style and uniqueness controls
  are retained; candidate length now follows the selected platforms.
- Per-run normalized deduplication; shared bounded 20,000-entry cache: Taken for
  10 minutes and unresolved profile absence for 1 minute. Cache hits show their
  original observation time. Manual retries refresh Unknown entries, preserving
  Taken cache hits and respecting all cooldowns.
- Globally paced requests per process: Minecraft bulk batches of 10, at most one
  start/second; TikTok/Snapchat at most one start/two seconds per platform. Three
  simultaneous searches maximum. Independent platform workers stream NDJSON as
  checks complete. Native Node fetch reuses its connection pool.
- Ten-second upstream fetch/body deadline, three attempts maximum for transient
  errors, exponential backoff with jitter. Retry-After seconds and HTTP dates
  are honored without shortening. Long throttle windows return retryable Unknown
  results immediately. 401/403 and opaque public pages open a five-minute circuit;
  exhausted transient failures open a 30-second circuit. No bypass/fallback
  route is used after an access restriction.
- Cancellation aborts active fetches, pending pacing/queue waits and generation;
  a disconnected stream or server shutdown also cancels checks. NDJSON respects
  backpressure, with small heartbeats for proxies. Configure any reverse proxy
  to disable response buffering for `/api/check`.
- Results show name and platform progress, all five status counts, elapsed time,
  evidence, cached timestamps, cooldown times, search/filter controls, retries,
  pagination and formula-safe CSV export. Only 50 rows exist in the DOM at once.
- Original dark/light themes, logo, layout, typography, icon subset, filter guide,
  word matching, advanced filters, result sorting, copy controls and reset are
  preserved. Server-backed pause/resume holds results and stops new batches.
  Session-skip behavior is preserved; unknown results remain explicitly retryable.
- Native keyboard controls, tab arrow-key navigation, focus indicators, reduced
  motion, live completion announcements and the original responsive layout.
  No remote fonts/scripts/analytics.

Limits are conservative application limits, not promises of platform quotas.
Network requests share one limiter per process: **deploy one Node instance** or
implement a shared limiter/cache before horizontal scaling. A 2,000-name public
social check can take about 67 minutes; blocked/opaque responses short-circuit the
remaining verification. More effort expands the candidate pool, not request speed.
This app sends candidate usernames to selected public platforms and keeps a
short-lived in-memory result cache. It does not persist searches or credentials.

## Optional confirmed restriction evidence

The application cannot infer a lock from a 404 or discover hidden reservation lists.
If an operator independently obtains explicit restriction evidence, set
`RESTRICTIONS_FILE` to the path of a JSON array. Records require `platform`, `name`,
`reason`, `source` (HTTPS evidence URL), `confirmedAt` and `expiresAt` (ISO dates).
Evidence must expire within 24 hours of confirmation; expired or malformed records
are ignored. This file is a **trusted operator assertion**, not automatic source
verification. Independently verify the evidence and set a suitably short expiry.
Do not populate it from guesses, profanity lists or profile absence.
`restrictions.example.json` is intentionally empty. Server-side configuration is
read-only to users and never accepts client-supplied restriction evidence.

## Verification

```sh
npm test
# On a machine with Chromium installed for Playwright:
npx playwright install chromium
npm run test:browser
# Optional, makes a handful of real unauthenticated requests:
npm run test:live
```

See `TESTING.md` for observed results and the browser-verification limitation.
See `SOURCES.md` for dated platform research and existing license attribution.
