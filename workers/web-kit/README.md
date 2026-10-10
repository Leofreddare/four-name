# Cloudflare web-only setup

No terminal or local Node installation required. This kit is a self-contained checking backend for Minecraft, Discord, GitLab and Last.fm; your website stays on its existing Node host.

1. Create a new GitHub repository named `four-name-checks` using github.com. Keep it private if preferred. Extract this ZIP, choose Add file > Upload files in GitHub, and upload worker.js, wrangler.jsonc and README.md to the repository root. Commit changes. Upload the extracted files, not the ZIP or enclosing folder.
2. Open dash.cloudflare.com > Workers & Pages > Create application > connect/import a Git repository (button labels may vary). Choose GitHub and authorize access to this repository, then select four-name-checks.
3. Use Worker/project name `four-name-checks` (matches the config), production branch `main`, root directory `/` (repository root), build command empty, deploy command `npx wrangler deploy`. This is a Cloudflare build setting, not a command you run on your computer. Choose Deploy. Cloudflare reads wrangler.jsonc and provisions one SQLite Durable Object and its CHECKS binding.
4. Open the deployed Worker > Settings > Variables and Secrets > Add. Type Secret, name CHECK_WORKER_SECRET. Use a password manager to generate a unique random value of at least 32 characters. Save it privately; choose Deploy to apply the secret. Never commit it to GitHub.
5. Copy the Worker HTTPS workers.dev URL from its overview.
6. In your WEBSITE host's server environment settings, set CHECK_WORKER_URL to that full HTTPS URL and CHECK_WORKER_SECRET to the same private value. Keep the website start command npm start; redeploy/restart from the host's dashboard. The main app already contains the integration in the latest four-name.zip.
7. Test ten Discord names from your website, then test other services individually. Minecraft profile absence is Unknown, not confirmed availability. Worker/provider blocking or signup changes must remain honest failures.
8. For errors, inspect Cloudflare deployment/build logs first, then Worker runtime logs. 401 = missing/mismatched shared secret; 429 = busy/rate limited; 502 = batch could not be verified. Opening the Worker URL directly in a browser returns Use POST (405), which is expected, not a failed installation. Do not paste the secret into browser JavaScript or URLs.

The bundle preserves the shared checker, schema validation, anonymous Last.fm CSRF flow, cache, cooldowns and globally coordinated request pacing. One deployment handles all four platforms. Do not deploy independent copies to multiply quotas.

The bundle is syntax-checked and exercised with local deterministic fixtures. It has not been deployed to your Cloudflare account or verified in the provider runtime. Test a small batch before larger searches. Cloudflare Workers Free and SQLite Durable Objects Free have daily quotas; long paced scans consume Durable Object duration. The worker is optional and cannot guarantee a live throughput improvement or bypass service restrictions.

Official references:
- https://developers.cloudflare.com/workers/ci-cd/builds/
- https://developers.cloudflare.com/workers/ci-cd/builds/configuration/
- https://developers.cloudflare.com/workers/configuration/secrets/
- https://developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/

Updated gateway handling: after checking the secret, the Worker returns a structured binding-missing error instead of crashing when CHECKS is absent. On Render, the updated app recovers through its built-in checker only for proven configuration errors before any remote checks were observed. It never switches after upstream blocking, cooldowns, timeouts, partial results or a previous working remote run. Worker 429 and throttled result batches wait and retry the same names (up to three retries).

If using the GitHub web deployment workflow, copy these three files to the root of your **checking-worker repository**, replacing the old versions. Let Cloudflare deploy with wrangler.jsonc; pasting worker.js alone does not provision CHECKS. Preserve the existing CHECK_WORKER_SECRET in Cloudflare and Render.
