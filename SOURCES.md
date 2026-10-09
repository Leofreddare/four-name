# Research and reuse — 2026-10-09

## Primary platform sources

- TikTok username help: https://support.tiktok.com/en/getting-started/setting-up-your-profile/changing-your-username
  Character restrictions, no trailing period, and username versus nickname.
  The official article does not document a definitive length range; lengths
  outside the common implementation range remain uncertain in this app.
- TikTok User Info: https://developers.tiktok.com/docs/en/tiktok-api-v2-get-user-info
  Documented API requires a bearer token and user authorization. It is not an
  unauthenticated arbitrary-username availability endpoint.
- Snapchat username help: https://help.snapchat.com/hc/en-us/articles/7012349845140-How-do-I-change-my-Snapchat-username
  3–15 characters; Latin letters, digits, hyphen, underscore and period;
  initial letter and final letter/digit. Phone numbers/content-policy constraints
  remain platform-side. Display names need not be unique.
- Snapchat Public Profile API setup: https://developers.snap.com/marketing-api/Public-Profile-API/GetStarted
  API access requires an allowlisted OAuth application; "public" profile
  endpoints do not make this a credential-free availability service.
- Snapchat API authentication: https://developers.snap.com/marketing-api/Ads-API/authentication
- Discord usernames and display names: https://support.discord.com/hc/en-us/articles/12620128861463-New-Usernames-Display-Names
  Unique username rules: lowercase Latin letters/digits/underscore/period,
  2–32 characters, no consecutive periods. Display names are not unique.
  Content and impersonation policy cannot be comprehensively tested locally.
- Discord user API reference: https://docs.discord.com/developers/resources/user
  The documented operations do not offer an unauthenticated unique-name
  availability check. Legacy/bot username fields must not be confused with
  the unique human username rules in the support article.
- Minecraft profile-name help: https://help.minecraft.net/hc/en-us/articles/4408950195341-View-or-Change-Your-In-Game-Profile-Name-in-Minecraft
  Java profile names versus gamertags, maximum length and name-change flow.
  The help page returned only its shell in one retrieval; its indexed excerpt
  and the implementation below were used to cross-check rather than claiming
  inaccessible content was inspected.
- Mojang issue WEB-2702: https://bugs.mojang.com/browse/WEB-2702
  Documents blocked name cases. Absence from the UUID registry cannot establish
  that a name passes the platform's moderation rules.

## Reputable implementations inspected

- Sherlock site manifest (MIT):
  https://raw.githubusercontent.com/sherlock-project/sherlock/master/sherlock_project/resources/data.json
  Inspected TikTok, Snapchat and Discord entries. Snapchat uses public profile
  status codes; TikTok uses missing-profile strings; Discord uses an undocumented
  signup probe. **None of these absence heuristics was copied as proof of
  claimability.** TikTok and Snapchat use exact positive structured profile matches for Taken.
  Discord now calls the unauthenticated signup check after direct live validation;
  its explicit boolean response is different from a missing-profile heuristic.
- CmlLib MojangAPI implementation (MIT):
  https://github.com/CmlLib/MojangAPI/blob/master/MojangAPI/Mojang.cs
  `CheckNameAvailability` uses `minecraft/profile/name/{name}/available` with
  `Authorization: Bearer`. Inspected the actual source, not just a checker site's
  claims. No CmlLib code is incorporated into this app.

## Direct live observations

A handful of unauthenticated probes ran from this workspace on 2026-10-09:

- Official Mojang bulk endpoint returned HTTP 200 and the matching Notch UUID.
  An absent test candidate was omitted, which establishes only lack of a
  current profile. Production adapter returned Taken and Unknown respectively.
- Actual Minecraft availability endpoint without authorization returned HTTP 401.
- TikTok's public `@tiktok` page returned matching `webapp.user-detail` profile
  data with status code zero, numeric user ID and exact `uniqueId`. The
  production adapter returned Taken.
- Snapchat's public `@teamsnapchat` page returned Next.js page data with a
  `userProfile` union (`$case: userInfo`), matching username and Snapcode URL.
  The production adapter returned Taken. An earlier request timed out; neither
  timeouts nor changed schemas are converted to Available.

These observations confirm current positive parsers, not permanent API contracts
or exhaustive naming policies. No login, CAPTCHA, proxy rotation or restriction
bypass was attempted. No live publicly verifiable locked-name list was found;
therefore no unsupported restricted-name guesses ship with the application.

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

## Service icons added on 2026-10-09

The selection control uses real brand SVG artwork, stored locally:

- Discord, Snapchat and TikTok: Font Awesome Free 6.7.2 Brands, downloaded from
  https://github.com/FortAwesome/Font-Awesome/tree/6.7.2/svgs/brands
  SVG attribution comments remain intact. CC BY 4.0 icon license and full
  attribution are preserved in licenses/FontAwesome.txt.
- Minecraft: recognizable colored grass/dirt block artwork by Neo-TheDragon,
  published in 2011 as public domain: https://www.rw-designer.com/icon-detail/5547
  Downloaded the actual ICO and converted its 256px representation to a local
  PNG. Source/attribution are in licenses/MinecraftIcon.txt. The previous Simple
  Icons wordmark is no longer used. Social SVGs retain the original monochrome
  styling; the grass block keeps its colors. No affiliation is implied.

## Follow-up implementation research and live probes

- https://github.com/alimawla961/discord-usernames-checker/blob/main/index.js
  Inspected the source's public `username-attempt-unauthed` POST and response
  handling. Wrote an independent strict parser; no source code copied, no proxy
  rotation or rate-limit bypass incorporated. Live `nova` returned 200 with
  `taken:true`; test candidate `fncheck8x9p2` returned 200 with `taken:false`;
  `discordtest` returned 400/50035/USERNAME_INVALID_CONTAINS. Production adapter
  corroborated the three outcomes. These are time-of-check results, not name
  reservations or an account-specific claim guarantee.
- https://github.com/SudoSuu/SnapchatUsernameChecker/blob/su/snapchat.py
  The old `get_username_suggestions` endpoint returned HTTP 404 for both a known
  name and a test candidate, even after a normal anonymous signup-page request.
  Do not bundle this broken method or its hardcoded CSRF token.
- https://accounts.snapchat.com/v2/signup
  Inspected current public JavaScript, including the username format validator:
  at most one internal separator. Corrected the shared local rule. The signup
  flow includes CAPTCHA/attestation; no account creation or challenge bypass was
  attempted. No reliable public availability replacement was established.
- https://github.com/onemanbuilds/TikTokUsernameChecker/blob/main/main.py
  The unique-id check method sends a session cookie from the user's token. One
  unauthenticated request to `api/uniqueid/check/?aid=1233&unique_id=fncheck8x9p2`
  returned HTTP 200 with an empty body, not a usable availability result.
- https://github.com/useragents/Proxyless-TikTok-Username-Checker/blob/main/main.py
  Its 404 branch labels names "Available or Banned". That does not distinguish
  claimable names, so it was not copied. The app retains positive profile
  evidence for Taken and honest Unknown results for everything inconclusive.

No executable source from these checkers is bundled. No tokens, passwords,
account creation, fabricated availability, CAPTCHA solving or restriction bypass.
