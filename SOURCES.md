# Sources and reuse

Three MIT projects were cloned and inspected on 2026-10-08. Their licenses
are included verbatim in licenses/.

- NameSpyglass: https://github.com/LangTian0110/NameSpyglass
  Commit: 91d7fd3bdb1a790c27e9b525957004074f83df31
  Adapted TokenBucket refill/acquisition from spyglass/ratelimit.py, adding
  cancellable waits and locking. Adapted the bulk parser from providers/mojang.py
  with stricter validation. Adopted public-screen/authenticated-confirm stages.
- Minecraft-Username-Gen-Checker: https://github.com/Ambuj0903/Minecraft-Username-Gen-Checker
  Commit: 89f384f2360b5c311e955f7880efea7807d54362
  Adapted random.choice-based generate_name to variable-length per-position pools,
  filtered sampling, duplicate removal, cancellation and finite fallback.
- minecraft-name-checker: https://github.com/Jarco-dev/minecraft-name-checker
  Commit: bf73eafc87fc8d435141a97452b98dbe4cda5f58
  Translated lowercase-name mapping/filtering from src/index.ts to the Python
  bulk parser. Discord notifications and cron were not incorporated.

Public-profile absence is labeled Unclaimed. Access-token functionality has been
removed. Results are never labeled verified or guaranteed claimable.

The web UI, server, orchestration, confirmation budget and tests were written
for this app. Upstream installers and executables were not run.

Font Awesome Free 6.x: https://github.com/FortAwesome/Font-Awesome
Icons are embedded as an SVG symbol subset, retaining their attribution comments.
The app icon is an original vector based on the generated design; interface controls use the Font Awesome subset. SVG icons use
CC BY 4.0; the complete upstream license is in licenses/FontAwesome.txt.

App icon: four ivory rounded diamonds, retained from the generated design and
implemented as a clean SVG with no background, frame or effects. The header uses
the SVG; the favicon uses the same transparent SVG. Image-tool
background removal was attempted; the vector implementation removes edge debris.

English word list: an original curated offline list of 2,278 common English words
with 3–7 letters. It supports substring matching, not exhaustive dictionary coverage.

Pages browser generator and lookup handler: original implementation, using the
same constraints as the local Python version. Cloudflare deployment layout follows
the official Pages Functions and Wrangler documentation linked in PAGES.md.

Lookup recovery uses three directly tested public Mojang/Minecraft bulk endpoints.
Successful responses must contain only requested names with valid UUIDs. HTTP
failures, malformed responses and connection errors never produce results.

Single-name fallback follows live-tested official profile GET responses. Notch
is checked against its known UUID before profile-not-found replies are accepted.
The deployed bulk POST routes returned HTTP 403 on mc-four-name.pages.dev;
single-name fallback must still be tested from that deployment after upload.

Render HTTP adapter: original implementation using only Node.js built-in APIs.
