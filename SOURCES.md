# Current platform research — 2026-10-09

## Final services

TikTok and Snapchat were removed from the selector and API. They did not expose
usable public availability checks in these probes. The final services are
Minecraft Java, GitLab.com, Last.fm and Discord. Minecraft remains requested by
the user; its public profile registry still cannot affirm claimability.

## GitLab

- https://docs.gitlab.com/user/profile/ — current username rules, 2–255 characters,
  ASCII letters/digits/underscore/hyphen/period, start/end and suffix restrictions.
- https://docs.gitlab.com/user/reserved_names/ — reserved top-level routes.
- https://github.com/gitlabhq/gitlabhq/blob/master/app/controllers/users_controller.rb
  Inspected `exists`, which calls Namespace.username_reserved?, not profile HTML.
- https://github.com/gitlabhq/gitlabhq/blob/master/app/models/namespace.rb
  Inspected the top-level namespace path/name lookup behind the public check.
- https://github.com/gitlabhq/gitlabhq/blob/master/lib/gitlab/path_regex.rb
  Official reserved route names were cross-checked against the live source.
- https://github.com/gitlabhq/gitlabhq/blob/master/app/models/user.rb
  Inspected AI prefix, shadowed-route, MIME extension and Pages-domain constraints.
  A namespace absence alone does not enforce every signup rule. The app excludes
  confirmed reserved names and conservatively leaves dotted/hyphenated candidates
  Unknown instead of asserting availability for hidden suffix/domain cases.

Live production bulk adapter: root → Taken; fncheck8x9p2 → Available; help →
Restricted/Reserved from official policy. Available means namespace unused and
supported local rules passed, not a name reservation or completed signup.

## Last.fm

- https://www.last.fm/join — official rules: 2–15 characters, initial letter,
  letters/digits/underscore/hyphen.
- https://github.com/zaan-app/scato/blob/master/scato/platforms.py
  Inspected the maintained socialscan fork's partial signup validation flow.
  Implemented independently; no MPL executable source was copied or bundled.
- https://www.last.fm/join/partial/validate — ordinary public signup validator.
  Anonymous CSRF token/cookie obtained normally from /join; no credentials,
  CAPTCHA solving or account creation. Parse only explicit username validity.
  The always-present positive success text alone is not evidence of availability.

Live production bulk adapter: rj → Taken; fncheck8x9p2 → Available. Session reuse
was verified. Other signup fields (email/password/CAPTCHA/terms) can be incomplete;
this endpoint only validates inputs and does not submit account creation.

## Discord

- https://support.discord.com/hc/en-us/articles/12620128861463-New-Usernames-Display-Names
- https://docs.discord.com/developers/topics/rate-limits
- https://github.com/alimawla961/discord-usernames-checker/blob/main/index.js
  Reviewed the public unauthenticated signup probe, then wrote strict independent
  parsing. No rotating proxies, alternate endpoints or bypass code incorporated.

Live bulk checks distinguished taken:true, taken:false and an explicit policy
rejection. Long cooldowns retry the same name after the full supplied window.

## Minecraft

- https://help.minecraft.net/hc/en-us/articles/4408950195341
- https://github.com/CmlLib/MojangAPI/blob/master/MojangAPI/Mojang.cs
  CheckNameAvailability requires Minecraft account authorization. The actual
  availability endpoint returned HTTP 401 without credentials. The Mojang bulk
  profile lookup returned Notch's UUID; absent candidates remain Unknown.

The actual official icon is downloaded unchanged from:
https://www.minecraft.net/etc.clientlibs/minecraftnet/clientlibs/clientlib-site/resources/favicon-96x96.png

Official icon background: https://www.minecraft.net/en-us/article/our-icons-are-changing
Usage guidelines: https://www.minecraft.net/en-us/usage-guidelines
The icon identifies Minecraft inside the selector; it is not the application
brand. Copyright Mojang/Microsoft; no affiliation implied. See MinecraftIcon.txt.

## Alternatives rejected after testing

- Reddit's documented username_available endpoint returned HTTP 403 here.
- Twitch's username validator returned IntegrityCheckFailed and an integrity
  challenge. No attempt was made to bypass it.
- TikTok's unauthenticated unique-id endpoint returned an empty HTTP 200.
- Snapchat's old suggestion endpoint returned HTTP 404.
- GitHub public account absence does not exclude reserved/blocked names.

These were not added as working providers. No missing profile, empty response,
challenge or HTTP failure is converted into Available.

## Other icon attribution

Discord, GitLab and Last.fm: Font Awesome Free 6.7.2 Brands, local SVGs from
https://github.com/FortAwesome/Font-Awesome/tree/6.7.2/svgs/brands
Attribution comments and CC BY 4.0 terms are retained in licenses/FontAwesome.txt.
Old TikTok/Snapchat SVGs and the third-party Minecraft image are no longer shipped.

## Preserved attribution from the attached application

The original archive recorded inspection/reuse of these projects on 2026-10-08:

- NameSpyglass: https://github.com/LangTian0110/NameSpyglass
  Commit 91d7fd3bdb1a790c27e9b525957004074f83df31.
- Minecraft-Username-Gen-Checker:
  https://github.com/Ambuj0903/Minecraft-Username-Gen-Checker
  Commit 89f384f2360b5c311e955f7880efea7807d54362.
- minecraft-name-checker: https://github.com/Jarco-dev/minecraft-name-checker
  Commit bf73eafc87fc8d435141a97452b98dbe4cda5f58.

The attached generator has been retained and extended. The unsafe absence-as-
unclaimed lookup behavior and old request orchestration were replaced; the original visual theme and interface
were restored at the user’s request. The original word list, help content and
Font Awesome icon subset are preserved. Original MIT license
files remain in `licenses/`. Historical Font Awesome attribution/license is also
preserved, and applies to the restored interface’s embedded icon subset.
No external images, fonts or icon CDN are needed.

Node built-ins implement the runtime server and fetch transport. jsdom and
Playwright are development-only dependencies, with their upstream licenses
retained in their installed npm packages and pinned in package-lock.json.
No upstream executable, installer or token-harvesting checker is bundled.


## 2026-10-10 updates

- User-supplied `upload/minecraft.png` resized to 36px for 18px display; separate asset notice updated.
- [GitLab non-configurable limits](https://docs.gitlab.com/rate_limits/non_configurable/): username-exists 20/minute/IP; use 3.1-second pacing, plus response-driven backoff.
- [Discord rate-limit documentation](https://docs.discord.com/developers/topics/rate-limits): interpret route headers and Retry-After; do not hardcode a guaranteed throughput for the internal signup validator.
- [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/) and [pricing](https://developers.cloudflare.com/workers/platform/pricing/): 100,000/day, 10ms CPU, 50 external subrequests/invocation on Free.
- [SQLite Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/): 100,000/day, 13,000 GB-s/day, SQLite-only Free support; one shared checker coordinator.
- [Render free services](https://render.com/docs/free): 750 hours/workspace/month; 15-minute idle sleep, approximately one-minute wake-up; single instance and outgoing-traffic constraints.
- Dictionary uses the original bundled 2,278-word list with a newly curated 273-word common subset; no third-party word corpus was copied. Generation/matching improvements are independently implemented.
- Current small live probes confirmed signup validators' explicit positive/negative evidence; Minecraft authenticated availability remained 401 unauthenticated. No account creation, tokens, platform logins or challenge bypasses.

2026-10-10 icon correction: latest image(20261010-111837).png now copied verbatim to the Minecraft service asset, replacing the earlier resized copy. No recoloring; 28px display and content-version query avoid stale icon reuse. Worker README now includes an ordered Cloudflare setup walkthrough.

2026-10-10 final UI correction: image(20261010-113801).png is the current supplied artwork. A nearest-neighbor 56px PNG preserves pixel colors at 28px display, now 1,254 bytes and embedded to prevent missing-asset deployment failures. The earlier verbatim asset above is superseded. Settings/Documentation use original inline outline SVGs; the GitHub header icon uses Font Awesome 6.7.2 brands/github.svg (CC BY 4.0), with attribution in licenses/GitHubHeaderIcon.txt and the retained Font Awesome notice.

Search-recovery research: Cloudflare official Durable Object getting-started guide confirms that the CHECKS namespace binding must be deployed alongside the exported class; uploading source alone is insufficient (https://developers.cloudflare.com/durable-objects/get-started/). Rechecked NameSpyglass's public lookup / authenticated final-confirmation distinction (https://github.com/LangTian0110/NameSpyglass), and compared its documented lookup and cooldown approach. Rechecked Discord checker 309 and its main.py/manage.py sources (https://github.com/mentaldefeat/309); its token-based sessions are not used here. No executable, tokens, proxy rotation or authentication bypass was adopted. Existing public signup adapters were verified with fresh small live probes. Changes are independently implemented; existing third-party license notices remain.
