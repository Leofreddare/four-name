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
Discord uses its public signup username check, without credentials. Only an exact
`{"taken":false}` successful response emits Available; `taken:true` emits Taken.
Recognized explicit platform restriction errors emit Restricted/Reserved. Unknown
schemas, challenges, access blocks and failures remain Unknown. This signup
endpoint is undocumented and can change. A check does not reserve a name or
ensure a particular account can claim it; recheck in Discord before claiming.

TikTok's official help specifies allowed characters and no trailing period, but
not a definitive length range. Generation uses the common 2–24 range; list input
outside that range returns Unknown rather than asserting Invalid. Snapchat's
phone-number and content-policy restrictions cannot be exhaustively decided
locally; matching the character format is not a claimability guarantee. Minecraft
checks Java profile names, not Bedrock/Xbox gamertags. No display-name availability
is implied for any platform.

## Interface and checks

The original monochrome dark/light theme, logo, Arial typography, short-name
filters, help dialog, result-card grid, copy, sort, pause, stop and reset controls
are preserved. The only new visible control group is the service selector.
It uses local service icons (a colored Minecraft grass block and social brand SVGs) and radio buttons: exactly one service at a time,
with Minecraft selected by default. The API also rejects multi-service requests.

The original Names to check slider starts at 2,000. Minecraft and Discord support
up to 10,000 candidates per run; TikTok and Snapchat cap runs at 2,000. Generation
keeps the original seven-character maximum; minimum length follows the service.
The existing advanced filters and offline English-word matching are retained.

**Only affirmatively Available results appear in the original name-card grid or
CSV export.** Taken, Invalid, Restricted/Reserved and Unknown remain internal
outcomes and are not displayed as names. Discord can emit Available from affirmative signup-check evidence. Minecraft,
TikTok and Snapchat cannot currently confirm availability without credentials;
Minecraft searches may show an empty grid and an "Unable to verify availability"
message. TikTok/Snapchat bulk availability searches are rejected immediately,
before generation or network activity, with the limitation explained. The
internal single-profile parser remains available for positive Taken observations. Profile absence is never
repackaged as availability. Progress counts still include all checked candidates.

There are no added status panels, status filters, per-result badges, evidence
cards or input-mode tabs. Results remain bounded to 50 cards per page for large
searches. The cached backend, streaming, timeouts, cooldowns, conservative pacing,
cancellation and server-backed pause/resume are retained.

Production transport has no third-party runtime dependencies. Native Node fetch
reuses connections. Minecraft uses batches of ten with at most one request start
per second; Discord starts at one request per five seconds and slows down after 429s.
The internal TikTok/Snapchat single-profile checks are paced at two seconds. Three
simultaneous searches maximum, with rates shared globally within one process.
Discord Available observations cache for only fifteen seconds and manual retry refreshes them.
Taken observations cache for ten minutes; unresolved absence caches for one
minute. Transient failures never turn into availability results. Fetch/body
requests time out after ten seconds; transient errors use at most three attempts
and exponential backoff with jitter. Retry-After windows are never shortened. Discord uses the longer of the header
and JSON retry_after windows. Bulk runs wait through long cooldowns with a
visible countdown and retry the same name automatically, at most three cooldown
recoveries per batch. The wait is cancellable and respects pause/resume.
401/403, opaque pages and exhausted transient retries interrupt a bulk scan.
No unrequested tail is counted as checked. The original Find names button becomes
Resume search for unfinished work, retaining completed results.
401/403 or opaque pages also stop further requests via a short circuit. No bypass is
attempted. Disconnects and Stop abort active and queued work.

Configure reverse proxies to avoid buffering `/api/check`. Deploy one Node
instance, or coordinate limits centrally before horizontal scaling. These are
conservative application limits, not promises of platform quotas. Candidate
usernames are sent to the selected public platform; no search history or
credentials are persisted. No public deployment was performed.

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
