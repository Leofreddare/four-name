# Optional checking workers

The app works locally with `npm start`; workers are optional. Generation, dictionary matching and candidate filtering stay in the browser worker. A remote checker can reduce origin CPU load or improve the upstream network route; it cannot increase a service's quota or promise a 5× live-search speedup.

## Cloudflare Workers + one Durable Object

From the app directory:

```sh
npx wrangler@latest secret put CHECK_WORKER_SECRET --config workers/wrangler.jsonc
npx wrangler@latest deploy --config workers/wrangler.jsonc
```

Use a random shared secret of at least 32 characters. On the main **Node server**, set `CHECK_WORKER_URL` to the deployed Worker HTTPS URL, and `CHECK_WORKER_SECRET` to that same secret. Restart `npm start`. These environment variables never enter browser code. Do not publish the secret in GitHub, a client config, or a URL.

`cloudflare.js` is the entry snippet; Wrangler bundles `lookup.js` and `platforms.js` directly, without a framework or runtime dependencies. Its single SQLite-backed Durable Object owns every service gate and shares caches/sessions across callers. Gate timestamps and throttled Discord intervals persist across object restarts; observation caches and anonymous sessions are intentionally ephemeral. Use this one checker deployment for the app. Do not run local and remote scans simultaneously to multiply service quotas, shard it by caller, rotate hosts, or circumvent platform challenges.

Calls contain at most ten Minecraft names or one other-service name. This stays well below the free-tier 50 external subrequests per invocation even with bounded retries and Last.fm's anonymous session setup. Browser requests remain same-origin; the Node integration calls the remote checker and streams each completed batch back to the UI. Pause prevents the next worker call; Stop aborts the app request. An already-running remote request may finish if the provider doesn't propagate disconnect cancellation, but no further app batches are launched. Interrupted worker calls preserve unfinished names for Resume search. Authentication, non-success responses, schema changes, and rate limits fail closed. Busy workers return 429, rather than starting parallel unpaced scans.

For confirmed, sourced restrictions, set a `RESTRICTIONS_JSON` secret with the same expiring record schema as `restrictions.example.json`. `RESTRICTIONS_FILE` is used only by the local Node checker, not automatically uploaded to the worker. Minecraft never emits Available from a public profile absence.

Free hosting limits verified against official documentation on 2026-10-10:

| Host | Free limits relevant to this implementation | Practical constraint |
| --- | --- | --- |
| Cloudflare Workers | 100,000 incoming requests/day; 10 ms CPU per ordinary Worker invocation; 128 MB memory; 50 external subrequests/invocation | The entry Worker only authenticates/routes. Checking is in the Durable Object. Free limits can terminate requests. |
| Cloudflare SQLite Durable Objects | 100,000 requests/day; 13,000 GB-s duration/day; 5 GB stored data; 5 million rows read/day and 100,000 rows written/day | Each batch persists one gate record. Long-running paced checks consume duration; the free tier is for modest use, not unlimited bulk traffic. |
| Render Free Node web service | 750 instance-hours/workspace/month; sleeps after 15 minutes idle; wake-up about one minute; cannot scale beyond one instance | Suitable for testing/hobby use; cold starts preclude consistently fast interaction. High outgoing traffic can trigger suspension. |

Sources: [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [Durable Object pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/), [Render Free](https://render.com/docs/free). Quotas are independent of upstream platform restrictions.

## Render / standalone Node alternative

Deploy this repository as a Node web service. Build `npm ci --omit=dev`; start `node workers/node.js`; health endpoint `/health`. Set `CHECK_WORKER_SECRET` on that service, and optional `RESTRICTIONS_JSON`. Set the main app's `CHECK_WORKER_URL=https://YOUR-SERVICE.onrender.com/check` plus the matching server-side secret. Keep a single worker instance, because Node's gates and caches are per process. Prefer an always-on instance for production. The existing `render.yaml` continues to deploy the full app directly; change the start command only for a separate checker service.

## Platform capabilities

| Service | Supported evidence | Limits |
| --- | --- | --- |
| Minecraft Java | Matching Mojang UUID profile → Taken; sourced live restrictions → Restricted/Reserved | Missing profile → Unknown. The actual Minecraft availability endpoint requires authentication (live unauthenticated probe returned 401). Public checks cannot prove locks/reservations absent. No account tokens accepted. |
| Discord | Explicit public signup `taken:false` → Available; `taken:true` → Taken; recognized policy rejection → Restricted/Reserved | Internal signup endpoint, not a guaranteed public developer API. Dynamic rate limits, access blocks or changed/challenge schemas → interruption/Unknown. No bot-token shortcut verifies arbitrary username claimability. |
| GitLab | Public signup namespace validator with local route/policy exclusions | 3.1-second request-start interval respects the documented 20/minute username-exists limit. Dotted or hyphenated names with uncertain hidden Pages/reserved-suffix policy remain Unknown. |
| Last.fm | Explicit username-field acceptance from public signup validation | Anonymous CSRF session only. No login, passwords, CAPTCHA submission or account creation. Missing session, blocking or response changes → Unknown/interruption. |

These snippets and their Node integration were tested with bounded deterministic fixtures; a real Cloudflare/Render deployment has not been performed. Current local live probes confirmed positive and negative signup responses on all three signup validators. Worker hosting may be blocked by a service even when the local environment succeeds; that must remain an honest failure, not trigger fallback hosts.
