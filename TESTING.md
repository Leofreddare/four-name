# Validation — 2026-10-08

`npm test`: all 7 test groups passed. Actual HTTP requests covered health, static
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

Client tests: generation ran in a real background thread using the browser worker
script; worker failures/unavailability fell back to client CPU; abort terminated
pending generation; WebGPU detection handled usable/missing/rejected adapters.
HTTP checks also passed for the new worker assets. UI flow verified reset cleared
cards/count/export/progress, remained available during a scan, and cleared results
stayed empty after polling and cancellation. Tests used simulated upstream replies.

One local 10,000-name English-filter benchmark: 1,221 ms before dictionary caching,
40 ms after caching. This measures CPU filtering only, not Minecraft lookup speed.

UI polish: the HTTP/DOM flow passed pause/resume (checked count remained fixed
while paused), retained scan state, duplicate-session skipping, new CSV status,
dark/light toggles, ETA pause state, and reset while running. Lookup/client test
suite: 7 groups passed. New icons are bundled. Scroll restoration preserved the same visible card position in a geometry-based
DOM test when an earlier sorted result was inserted. Actual browser scroll
behavior has not been visually tested.
No live Render deployment or availability authentication was used.

Latest regressions: the Reset control no longer uses id="reset", which masks the
native form reset method. HTTP tests enforce the renamed control. The DOM flow
passed cancellation and clearing, a single checked-count label, newest-first
insertion at scroll position zero, and preserving a scrolled card offset when
a newer result is inserted. Scroll geometry is simulated, not browser visual QA.
