# Optional network boost

The app works with `npm start` alone. Its own checker remains in charge of parsing,
classification, cache, retries and streaming. With CHECK_WORKER_URL configured, the
Cloudflare Worker only forwards the supported public API requests and returns raw
upstream responses. Its shared gates coordinate request starts across app callers.
It does not generate candidates or decide that usernames are Available/Taken.

Update the main app on Render **and** the three files in `workers/web-kit/` in your
Cloudflare-connected worker repository. Existing secrets and URLs can stay unchanged.
An old worker rejects the new transport protocol before an upstream request; the app
then uses its built-in requests until restart. Upstream blocks/throttling/failures never
cause host rotation. Keep one route per service.


The app works locally with `npm start`; workers are optional. Generation, dictionary matching and candidate filtering stay in the browser worker. A remote checker can reduce origin CPU load or improve the upstream network route; it cannot increase a service's quota or promise a 5× live-search speedup.

## Recommended setup, step by step

Use Cloudflare Workers Free with the included SQLite Durable Object for the checking backend. Keep the existing website on its current Node host. One deployment handles Minecraft, Discord, GitLab and Last.fm. The browser generation Worker is already included and needs no hosting account. The optional Cloudflare checker is a network helper, not a replacement for app logic.

1. Download/extract the newest four-name.zip. Replace the website files on your Node host (or update your GitHub repository if that host deploys from GitHub), then restart/redeploy. This applies the supplied icon too; a downloaded ZIP does not automatically change a live deployment.
2. Create a Cloudflare account at https://dash.cloudflare.com/ and use Workers Free. No custom domain is required for a workers.dev address.
3. Install Node 22 or 24 on your computer. Open a terminal in the extracted `four-name` directory, where `package.json` and the `workers` folder are visible. Keep the full directory structure; the snippet imports the shared checker.
4. Run `npm ci`. Then run the three Wrangler commands below. Login opens Cloudflare authorization in your browser. Deploy creates the Worker and Durable Object from the included config; leave the shared-checker design intact.
5. Before the `secret put` command, generate a private secret with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Save it privately. Paste this value when Wrangler prompts for CHECK_WORKER_SECRET.
6. Copy the HTTPS workers.dev URL printed by Deploy.
7. On the website's **Node host**, open its environment-variable settings. Set `CHECK_WORKER_URL` to that URL and `CHECK_WORKER_SECRET` to the same private value. These are server variables, not HTML/JavaScript or browser settings. Keep the website's start command `npm start`.
8. Restart/redeploy the website. This enables raw-response networking through the remote coordinator; result handling stays in the app.
9. Start a small 10-name search with one service. Test Discord first, then the others individually. Minecraft missing-profile results being Unknown is expected; workers cannot confirm Minecraft claimability publicly. Signup validators may block a cloud-hosted IP; do not treat that as availability or add fallback hosts to evade it.
10. The updated app can return to its built-in Node checker after a confirmed configuration failure (401/404/405 or binding-missing), only before any remote checks were observed in this process. It does not switch for platform blocks, throttling, timeouts, unknown Worker failures, partial results or previously working remote checks. To keep using Cloudflare, correct the configuration and restart Render. Worker busy/platform cooldowns automatically wait and retry the same batch, up to three retries. If a request fails, inspect Cloudflare Workers > four-name-checks > Logs. 401 means missing/mismatched shared secret; 429 means worker busy/rate limited; 502 means the worker could not verify the batch. Check the app notice and resume only after any cooldown. To return to the built-in Node checker, remove both CHECK_WORKER variables and restart the website.

Worker hosting deployment is not verified yet. Perform the small live test before using large batches. The current account-free signup adapters were verified from the local environment; a provider IP may behave differently.

## Cloudflare Workers + one Durable Object

From the app directory:

```sh
npx wrangler@latest login
npx wrangler@latest deploy --config workers/wrangler.jsonc
npx wrangler@latest secret put CHECK_WORKER_SECRET --config workers/wrangler.jsonc
```

Use a random shared secret of at least 32 characters. On the main **Node server**, set `CHECK_WORKER_URL` to the deployed Worker HTTPS URL, and `CHECK_WORKER_SECRET` to that same secret. Restart `npm start`. These environment variables never enter browser code. Do not publish the secret in GitHub, a client config, or a URL.

`cloudflare.js` is the entry snippet; Wrangler bundles `lookup.js` and `platforms.js` directly, without a framework or runtime dependencies. Its single SQLite-backed Durable Object owns every service gate and shares caches/sessions across callers. Gate timestamps and throttled Discord intervals persist across object restarts; observation caches and anonymous sessions are intentionally ephemeral. Use this one checker deployment for the app. Do not run local and remote scans simultaneously to multiply service quotas, shard it by caller, rotate hosts, or circumvent platform challenges.

Calls contain at most ten Minecraft names or one other-service API request. This stays well below the free-tier 50 external subrequests per invocation even with bounded retries and Last.fm's anonymous session setup. Browser requests remain same-origin; the Node integration calls the remote checker and streams each completed batch back to the UI. Pause prevents the next worker call; Stop aborts the app request. An already-running remote request may finish if the provider doesn't propagate disconnect cancellation, but no further app batches are launched. Interrupted worker calls preserve unfinished names for Resume search. Authentication, non-success responses, schema changes, and rate limits fail closed. Busy workers return 429, rather than starting parallel unpaced scans.

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

## Browser-only worker updates

A current self-contained bundle is included in `workers/web-kit/`. Upload that directory's three files to the root of your checking-worker GitHub repository and let Cloudflare build/deploy with its `wrangler.jsonc`. The main website files belong in the Render-connected repository. No secret belongs in either GitHub repository. For the simplest initial check, remove CHECK_WORKER_URL from Render and redeploy: the app uses its built-in backend, and Cloudflare is optional.

## One worker or separate service workers (web dashboards)

Start with **one Cloudflare worker** using the updated bundle in `workers/web-kit/`.
It now admits different services independently, with two Minecraft batches sharing
one gate. Separate workers are optional; they do not make a single service's quota larger.

To isolate services with separate Cloudflare deployments:

1. For each dedicated service, create its own GitHub checking-worker repository containing
   the three files from `workers/web-kit/` at its root. In the GitHub web editor, change
   the `name` value in wrangler.jsonc to a distinct name, such as `four-name-minecraft`.
2. Create a Cloudflare Worker project for each service you want to isolate, connected
   to its matching repository. Use the same project name you put in wrangler.jsonc.
   Keep the deploy command `npx wrangler deploy`. Keep the Durable Object binding/class
   and migration declarations; Cloudflare provisions that project's namespace.
3. In each Worker’s **Settings → Variables and Secrets**, set secret
   `CHECK_WORKER_SECRET` to your private random value (at least 32 characters).
   In the repository's wrangler.jsonc, add a `vars` object with `CHECK_SERVICE` set to exactly
   `minecraft`, `discord`, `gitlab`, or `lastfm`, matching that project's purpose.
   For example: `"vars": {"CHECK_SERVICE": "minecraft"}`. Commit to deploy.
   The secret remains in the Cloudflare dashboard; never put it in this config.
4. Copy each project's HTTPS workers.dev URL. In **Render → your website service →
   Environment**, add the matching URL variable below. Use one deployed worker per
   service; do not configure or rotate a pool of workers for the same service.
5. Set the shared `CHECK_WORKER_SECRET` on Render if using the same secret everywhere.
   For different secrets, add the corresponding per-service secret variable below.
6. Upload the updated main app files to the Render-connected repository and redeploy.
   Test a small list separately on each service. Provider blocking is an honest failure;
   it never triggers switching that service to another worker.

| Service | URL variable on Render | Optional secret override on Render |
| --- | --- | --- |
| Minecraft | `CHECK_WORKER_MINECRAFT_URL` | `CHECK_WORKER_MINECRAFT_SECRET` |
| Discord | `CHECK_WORKER_DISCORD_URL` | `CHECK_WORKER_DISCORD_SECRET` |
| GitLab | `CHECK_WORKER_GITLAB_URL` | `CHECK_WORKER_GITLAB_SECRET` |
| Last.fm | `CHECK_WORKER_LASTFM_URL` | `CHECK_WORKER_LASTFM_SECRET` |

Per-service URL overrides take precedence over `CHECK_WORKER_URL`. A service without
an override uses that shared URL, or the built-in Node checker if the shared URL is absent.
Per-service secrets fall back to the shared `CHECK_WORKER_SECRET`. All of these variables
remain on the servers. Existing single-worker configuration continues to work.

The worker's `CHECK_SERVICE` restriction prevents it from checking other services.
Admission is bounded per service even for the all-service worker. Existing namespace
and class names are preserved on updates; do not delete the Durable Object or change its
identity to reset rate limits. Cloudflare account quotas still apply across workers.
The dashboard workflow and live provider behavior must be verified in your account.
