FOUR NAME — RENDER EDITION

1. Extract this ZIP.
2. Upload its contents to a GitHub repository. Put package.json and server.js at
   the repository root. Keep the public folder and other files beside them.
3. Render → New → Web Service → connect that repository.
4. Choose:
   Runtime / Language: Node
   Root Directory: leave blank (when package.json is at the repository root)
   Build Command: npm ci
   Start Command: npm start
   Instance Type: Free
   Health Check Path: /health
5. Create Web Service. Open its onrender.com URL once deployment says Live.
6. Set Pattern to a known name such as notch (length 5) and run Find names. A
   successful lookup must finish with one checked name and no Unclaimed result.

No Minecraft token, database, Python, or extra npm dependencies are required.
The server uses Render's PORT and binds to 0.0.0.0.

If you already uploaded everything into a subfolder in GitHub, set Render's Root
Directory to that folder instead of moving the files.

Render deploys this project from Git, rather than from a Cloudflare ZIP upload.
Choose Web Service, not Static Site. Manual setup does not require using the
optional render.yaml Blueprint.

Run locally with Node.js 22 or 24: npm start. Open http://localhost:3000.
Run tests: npm test.

The UI preserves the 3–7 length slider (default 4), batch slider (default 10,000),
English-word and leetspeak settings, transparent icon, animations, help and export.
Scans stay in the browser and disappear on reload. Closing the browser stops its
scan. Reload the page if a Render service restart interrupts a lookup.

Lookup failure never produces an Unclaimed result. The server tries public bulk
endpoints, then paced single-name GET lookups after verifying Notch's known UUID.
Unclaimed means no current profile was found, not guaranteed claimability.

Render's free web service sleeps after 15 minutes without incoming traffic and
can take about a minute to wake. Free usage and outbound API traffic have limits.
Minecraft access from your Render deployment must be tested after deployment;
local test success is not a guarantee that Render's outgoing IP is accepted.

https://render.com/docs/deploy-node-express-app
https://render.com/docs/web-services
https://render.com/docs/free

Reset now clears all results, progress and export state, cancels any active scan,
and resets the filters. Pending replies cannot bring cleared names back.
Name generation runs in a Web Worker when supported, with a client CPU fallback.
English dictionary matching is cached for faster filtering. Open Help → Client
performance to see generation mode and WebGPU adapter availability. WebGPU is
only detected: it does not speed up Minecraft network checks and is not used
for compute. The server still performs the verified Minecraft lookups.

POLISHED SCAN CONTROLS
Pause holds progress and stops new lookups until Resume; an in-flight batch may
finish, but its results are held. Stop ends the scan. Reset clears the result list.
Names to check is the candidate batch slider. Skip names checked this session
avoids duplicate lookups until reload; Check order chooses Random, A–Z or Z–A.
The progress bar and approximate ETA use successful checks and exclude pauses.
The moon/sun button toggles a saved light/dark theme, with dark as the default.
Result order defaults to discovery order. Scroll anchoring preserves a visible
card when new results or sorting change the grid. Export as CSV uses the explicit
no_active_profile status instead of implying claimable availability.

LOCKED NAMES
The public lookup can return no active profile for a name which Minecraft still
reserves, locks or blocks. The actual /minecraft/profile/name/{name}/available
endpoint was tested without credentials and returned HTTP 401. This package
cannot guarantee claimability or exclude every locked name without authenticated
availability checks. No token entry has been added. Confirm a selected name on
Minecraft.net while signed in. The UI now says No active profile instead of
implying that these candidates are guaranteed available.

NETWORK PERFORMANCE
Two browser lookup pipelines overlap network waits. All Render visitors still
share the server's bulk pacing of approximately one request per 700 ms. Rate-limit
replies pause dispatch. Client workers generate candidates; duplicate session
checks are skipped when enabled. No faster upstream rate is promised.
