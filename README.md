# Four Name

The original dark/light interface with Minecraft Java, GitLab, Last.fm and Discord.
TikTok and Snapchat were replaced with services that returned usable public
username-check responses in live verification. Exactly one service is selected;
Minecraft remains the default. The existing layout, controls and available-only
name grid are preserved. No tokens, passwords or login are required.

## Run

Node.js 22–24:

```sh
npm ci
npm start
```

Open http://localhost:3000. Set PORT for another port. For production use
`npm ci --omit=dev`. The included Render configuration starts a Node server.
Replace the application files and restart the server when updating. No public
hosting deployment was performed.

## Availability evidence

- Last.fm: the public partial signup validator must explicitly accept the
  username. A positive success message alone is insufficient: it also appears
  in negative responses. The app obtains an anonymous CSRF cookie through the
  ordinary public signup page and reuses that session for ten minutes. It never
  submits a password, creates an account or attempts to solve a CAPTCHA.
- GitLab.com: the public signup namespace check must explicitly return
  `exists:false`, and the candidate must pass local naming/reservation checks.
  Official reserved routes, AI prefixes and shadowed route prefixes are excluded.
  GitLab also restricts filename extensions and hidden Pages domains. Candidates
  containing periods or hyphens that cannot be fully cleared remain Unknown,
  even if the namespace endpoint returns false. Generation defaults use short
  letters/digits/underscore candidates to avoid those ambiguous cases.
- Discord: the public signup check must explicitly return `taken:false`.
  Specific platform policy rejections are Restricted/Reserved. Undocumented
  signup endpoints may change; unfamiliar responses fail closed.
- Minecraft: matching names and UUIDs confirm Taken. Missing profiles remain
  Unknown because public lookup cannot rule out locked, reserved or blocked
  names. The actual Minecraft availability endpoint requires account
  authorization; no credentials are collected. Minecraft is retained at the
  user's request, with this accuracy limitation.

Every positive check is a time-of-check observation, not a reservation or
account-specific guarantee. Confirm on the service before claiming a name.

| Status | Evidence |
| --- | --- |
| Available | Explicit positive signup/namespace response and applicable local checks. |
| Taken | Matching Mojang profile or service reports name already unavailable/occupied. |
| Restricted/Reserved | Explicit platform rejection, official reserved policy, or sourced operator evidence. |
| Invalid | Violates supported naming rules. |
| Unknown | Inconclusive, hidden reservation risk, request failure, throttling or changed schema. |

Only Available names appear as cards or in CSV export. Other statuses are
retained for processing, not mixed into the result list. Results render in pages
of 50. The names slider defaults to 2,000. Minecraft/Discord permit up to 10,000
candidates; GitLab/Last.fm cap each run at 2,000. The original generation control
keeps its seven-character maximum. Service validation is separate from that
short-name generation limit.

## Reliability

Native Node fetch reuses connections. Requests share process-wide pacing gates:
Minecraft uses batches of ten, one start per second; GitLab/Last.fm start at one
request per two seconds; Discord starts at one per five seconds and slows after
429s. Last.fm's initial session request is also paced. These are conservative app
limits, not a promise of platform quotas. Three simultaneous searches maximum.

Available observations cache for only 15 seconds; occupied observations for ten
minutes; unresolved results for one minute. Manual resume refreshes candidates
that require verification. Each fetch/body has a ten-second timeout; transient
failures have at most three attempts with backoff. Retry-After is honored. Discord
uses the longer supplied header/body window. Bulk searches show a cooldown
countdown and retry the same candidate automatically, at most three cooldown
recoveries. Stop cancels active requests and waits; Pause holds new work.

Access blocks and exhausted transient failures interrupt the run. Unrequested
names are never counted as checked. The existing Find names button becomes
Resume search and retains completed results. No proxy rotation, CAPTCHA solving,
authentication bypass or fabricated availability is used.

Run one server instance for shared in-memory limits, or coordinate them centrally
before scaling. Reverse proxies must not buffer /api/check. Candidate names are
sent only to the selected service; anonymous session cookies remain server-side.
No credential or search-history storage is used.

## Optional Minecraft restriction evidence

RESTRICTIONS_FILE may point to a trusted operator JSON array of explicitly
confirmed restrictions. Records require platform, name, reason, source HTTPS URL,
confirmedAt and expiresAt; evidence must expire within 24 hours. This is a trusted
assertion, not automatic source verification. Never populate it from missing
profiles or guesses. The example file intentionally contains no names.

## Verification and attribution

`npm test` runs the automated suite. `npm run test:live` makes a handful of real
public checks. The optional Playwright suite requires a working Chromium install.
See TESTING.md for exact checks and the browser limitation, SOURCES.md for research,
and licenses/ for retained attribution. The Minecraft selector uses the actual
96px favicon downloaded unchanged from Minecraft.net, not the earlier third-party
block image or text mark. Social brand SVGs are local Font Awesome assets.
