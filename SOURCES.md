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
  claimability.** This app uses exact positive structured profile matches for
  social Taken results and does not call Discord's undocumented signup probe.
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
