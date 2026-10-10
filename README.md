# Four Name

Generate and check usernames while retaining the original dark/light theme and available-only result grid. Minecraft is selected by default. Minecraft and Discord are visible initially; Settings enables GitLab and Last.fm, saves service preferences in this browser and always leaves at least one service enabled. Searches select exactly one service. Settings, Documentation and the requested [GitHub repository](https://github.com/Leofreddare/four-name) use compact SVG icon buttons with accessible names and tooltips. The latest supplied Minecraft image, image(20261010-113801).png, is optimized to a 56×56 PNG (1,254 bytes) for 21.28 CSS pixels (another 5% smaller, aligned left inside the unchanged service button) and embedded in the app. No separate image upload/request is needed. Colors and pixel artwork are preserved. The search count has one visible slider; generation mode is in Advanced and the explanatory paragraphs are removed.

## Run

Node 22–24:

```sh
npm ci
npm start
```

Open http://localhost:3000. Production installs can use `npm ci --omit=dev`. Set `PORT` as needed. `render.yaml` deploys the full Node app. Restart after changing assets: the server keeps prepared static responses in memory. No production hosting deployment was performed.

## Generation coverage

**Before:** spaces of at most 200,000 combinations were enumerated, then capped by the name budget. Larger spaces used at most `max(1000, budget × 30)` random attempts, biased toward required characters and dictionary fragments. That was a subset: candidates could be missed, and restrictive filters could produce short batches even when more matches existed. Character presets omitted periods/hyphens and the UI stopped at seven characters.

**Now:** Exhaustive traversal is the default. It traverses the Cartesian product of the selected per-position character pools exactly once using an odometer and BigInt cursor. Fixed positions, prefix/suffix, excluded/custom characters, start/end types and shape equality groups constrain those pools. Every remaining combination is tested against the shared service rules, English matching, required/contains/avoid text, unique/adjacent-repeat and count filters. Paired/alternating shapes enforce their distinct-block meanings. No randomized placement or attempt cap excludes combinations in this mode.

The count is still a **per-run check budget**: default 2,000, up to 10,000 for Minecraft/Discord or 2,000 for GitLab/Last.fm. It does not promise that a huge space is checked in one run. After completing a batch, Find names with unchanged settings continues at the next cursor. Interrupted checks use Resume search for unfinished names first. Stop during generation does not commit the unsubmitted cursor. Reset, changed generation settings, or a page reload starts a new traversal; completed checks can be skipped within the browser session. Once a space is exhausted, repeating it with session skipping produces no new names.

The results panel reports candidates generated; its tooltip retains combinations visited and combinations in the constrained pools. This denominator is an **upper bound before final filters**, not a fabricated count of matching or claimable names. Finding an exact filtered count generally requires visiting the whole space. A four-letter letters-only space has 26⁴ = 456,976 combinations; a full enumeration can be huge. Tight filters can therefore take time even if the check budget is small. Stop remains responsive.

Generation supports 2–32 characters, with the selected service's minimum/maximum applied. Minecraft stops at 16 and Last.fm at 15. GitLab permits longer usernames but the generator intentionally caps them at 32. The extended character preset adds periods and hyphens; service-incompatible characters/positions are pruned. Names normalize to lowercase account identities. Uppercase spelling variations are not separate candidates. The selected character preset/custom-set intersection defines the coverage; characters outside it are deliberately excluded.

**Sampled / word-prioritized subset** retains the faster randomized approach for enormous or strongly constrained spaces. It is explicitly labeled and can miss matches; it is not exhaustive. Small spaces may still be enumerated in sampled mode. Generation posts batches of at most 512 matching names plus progress from a module Worker; only the current budget (at most 10,000 names) is buffered, rather than the whole search space. Browsers without Worker support use the same algorithm with periodic yields. Checking starts after this bounded candidate batch is prepared.

## Filters and English matching

Contains, Exclude characters, Must include characters, Avoid text and No adjacent repeats are now normal controls. Specialized counts, custom character sets, positional character classes and check order stay in Advanced. Word controls provide:

- Common curated vocabulary (273 words) or the broader bundled vocabulary (2,278 words), plus custom 3–32-letter words.
- Substring matching or whole-word boundaries: `cat` matches `scatter` only in substring mode. Boundaries are non-letter characters or the name's edges; this is dictionary matching, not linguistic tokenization.
- Anywhere, at start, at end, or whole-name position; minimum word length of 3–7 letters.
- Optional leetspeak, disabled by default to avoid accepting digit substitutions unexpectedly.

Generation and result filtering share one matcher. The dictionary and help guide load on demand; generation, vocabulary matching, session deduplication, sorting and filtering stay on the client. Only Available names enter the grid/export. Other observations remain internal for progress and retries.

## Availability and limitations

The statuses remain Available, Taken, Restricted/Reserved, Invalid and Unknown. No failed request, missing profile, challenge page or unexpected JSON is availability evidence. Available is an observation, not a reservation or guarantee of successful claiming.

- **Minecraft Java:** exact matching public UUID profiles confirm Taken. Missing profiles stay Unknown: locks, reservations and moderation blocks cannot be ruled out publicly. The authenticated Minecraft availability endpoint returned HTTP 401 in the current unauthenticated live probe. No tokens or passwords are accepted. To mark a confirmed restriction, set `RESTRICTIONS_FILE` to sourced, timestamped, expiring evidence records using `restrictions.example.json`. There is no invented hardcoded locked-name list.
- **Discord:** explicit public signup `taken:false` confirms Available; `taken:true` confirms Taken. Recognized policy rejections are Restricted/Reserved. This internal signup endpoint is not a guaranteed public developer API. Rate limits, access blocks and changed/challenge schemas can interrupt searches. Discord display names and old `#tag` forms are not usernames.
- **GitLab:** explicit signup namespace `exists:false` is accepted only after local reservation checks. Known routes/AI prefixes are restricted. Dotted/hyphenated candidates remain Unknown where hidden Pages/reserved-suffix policy cannot be excluded. Default pacing is 3.1 seconds per request start, below the documented username-exists limit of 20/minute/IP; returned throttling can require longer waits.
- **Last.fm:** the partial signup validator must explicitly accept the username field. An echoed success string alone is insufficient. The server reuses an anonymous CSRF signup session for ten minutes; it never logs in, submits passwords, creates accounts or solves challenges.

## Performance and measurement

Raw baseline/final data and a reproducible script are in `benchmarks/`. Latest local Node measurements on this workspace:

| Measurement | Before | After | Meaning |
| --- | --- | --- | --- |
| Initial document/CSS/eager module transfer | 105,397 bytes, uncompressed | 24,503 bytes, Brotli | About 4.3× smaller; embedded Minecraft/header icons included after, separate icons excluded; dictionary, generator and help split from initial module graph. Not an input-to-paint measurement. |
| Generate 10,000 unfiltered four-letter candidates, five-run median | 42.7 ms | 8.0 ms | About 5.3× in this run; warm-up and contention cause variation. No claim of equivalent live API speedup. |
| Cached 10,000-name checker + JSON serialization, five-run median | 15.3 ms | 11.2 ms | About 1.36×; result chunks grow to 512 rather than emitting a single cached Discord row each time. Synthetic cached evidence only. |
| 40 Minecraft names with synthetic 25-ms upstream delay | 107 ms, sequential | 54 ms, two requests overlapping | About 2× on the fixture. Real starts remain globally paced; provider latency/limits dominate. |
| JSDOM slider input / theme toggles / 50-row page change | No baseline | 7.4 / 0.8 / 5.9 ms | JS/DOM dispatch only; no browser paint measurement. |
| Synthetic 10,000-result UI search | No baseline | 71.8 ms | Retains all observations, renders only 50 cards/page. No fabricated production results. |

Static responses are read/precompressed once per process, served as Brotli/gzip when accepted, and revalidated with ETags/304 rather than retransmitting unchanged assets. The supplied Minecraft icon is embedded and optimized; other service icons use compact SVGs. Disabled optional service images are fetched only when enabled. Inline header SVGs need no image requests. Streaming maintains an Available-only index, skips result rebuilds for nonavailable rows, schedules updates with animation frames, caches DOM lookups and avoids idle redraws after a search. Only 50 cards are rendered at once. Native fetch reuses connections where the runtime supports it. Cached checks adapt up to 512 rows; uncached Mojang batches remain ten. Two Minecraft requests may overlap their network time while sharing one start gate. Other signup checks remain sequential and globally paced. Maximum three searches are admitted per Node process, with bounded upstream bodies, ten-second request/body deadlines, bounded retry/backoff, rate-header cooldowns, cancellation and pause controls. Results stream as batches finish. Transient failures halt without counting an unrequested tail.

These changes meet the local speed goal on the simple generator; **uncached external searches are not 5× faster overall**. A 2,000-name Discord scan can still take hours at conservative public pacing, and an API block can halt it. Workers can improve routing/offload server work; they cannot remove quotas. Do not deploy independent checker replicas to multiply platform request rates.

## Workers and verification

See [workers/README.md](workers/README.md) for verified current Cloudflare/Render free limits, deployment commands, server-side secrets, four-service support and integration. The app automatically uses the optional remote checker when its Node server has `CHECK_WORKER_URL` and `CHECK_WORKER_SECRET`. Cloudflare uses a single Durable Object; the Node snippet is a single-instance alternative. These snippets are locally tested; hosting deployment/provider-runtime validation remains to be performed.

```sh
npm test
npm run test:live
node benchmarks/measure.mjs
npm run test:browser
```

39 automated tests pass, covering coverage/resumption, English matching, service rules, restricted Minecraft evidence, rate limits, concurrency, cancellation, pause, compression/ETags, bounded DOM, optional service settings and worker validation. Small live probes on 2026-10-10 confirmed Minecraft Taken/Unknown, Discord Taken/Available/Restricted, GitLab Taken/Available/Restricted, Last.fm Taken/Available, and Minecraft availability's 401. Playwright screenshot verification could not run because its Chromium executable is unavailable in this environment; visual/real-browser responsiveness is not claimed verified.

Original app/third-party notices remain in `licenses/`; the supplied branding is identified separately. See `SOURCES.md` for implementation/API research.

## Search recovery update

The server previously hid thrown worker failures behind the same generic Search interrupted message for all services. It now preserves safe, actionable gateway errors without exposing credentials. Known worker configuration failures before any remote checks were observed recover through one shared built-in Node checker; API blocks, throttling, timeouts, unrecognized errors, partial results and prior working remote checks never switch hosts. Worker 429 responses (numeric or date Retry-After) and platform cooldown rows wait and retry the same batch, with cancellation, pause and a three-retry bound. Correct the worker configuration and restart Render to return to Cloudflare.

The Settings icon now uses the existing compact sliders glyph. Minecraft artwork alone is scaled down 20%; the button and its spacing stay unchanged.

## Minecraft profile candidates and service routing

Minecraft public checks return Taken or Unknown, not confirmed Available for absent profiles. The main Available grid/export retains its strict evidence requirements. A separate collapsed Minecraft panel now lets users review/copy names with no public profile, explicitly labeled unverified. It displays at most 50 candidates per page, creates no candidate cards while collapsed, excludes blocked/transient/policy results, and reports taken/no-profile counts. It does not infer that any candidate is claimable.

The GitHub link now has the same rounded background/border/hover behavior as its neighboring buttons. Minecraft artwork is scaled to 21.28px and moved left; its button footprint is unchanged.

Remote Minecraft calls now use two bounded lanes of ten names, sharing the Worker coordinator's existing globally paced Minecraft gate. Worker admission permits at most two Minecraft calls and one per other service; separate services no longer block each other. Gate persistence writes are serialized. Searches in the UI still choose one service. Per-service URL/secret overrides are described in workers/README.md; no random worker rotation is performed. Different service routing isolates workloads and may improve routing, but does not multiply the same platform's quota or prove Minecraft availability. Provider runtime and deployed-site validation remain outstanding.
