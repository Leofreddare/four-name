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
