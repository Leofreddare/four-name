# Validation — 2026-10-08

`npm test`: all 3 test groups passed. Actual HTTP requests covered health, static
assets, private-path rejection, methods, body limits and lookup response forwarding.
Lookup tests covered valid profiles, forbidden cross-origin requests, name schema,
429 handling, blocked endpoints, known-profile GET verification, exact missing
profile validation, and blocked-bulk cooldown. No failure was accepted as a result.

The server entry point passed an assigned-PORT startup and health test. The HTML
JavaScript passed the local HTTP integration harness against this Node server,
with simulated upstream replies: search, 3–7 slider, 10,000 batch slider, English
and leetspeak filters, help dialogs, sort, copy, CSV and reset.

No live Render service has been deployed or tested in this session. Local checks
cannot establish whether Minecraft will accept the eventual Render egress IP.
