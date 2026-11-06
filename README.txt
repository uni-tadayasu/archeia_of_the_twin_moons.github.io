DRACO loading repair - 2026-11-07

Cause confirmed in the Chrome console:
- HEAD /assets/vendor/draco/draco_decoder.js -> HTTP 404
- Request to www.gstatic.com/draco/versioned/decoders/1.5.7/draco_decoder.js -> blocked by connect-src Content Security Policy

Changes:
- index.html: allow https://www.gstatic.com in connect-src only; keep wasm-unsafe-eval and all existing restrictions. Bump JS cache version.
- model-runtime.js: skip nonexistent local decoder and use the pinned official JS decoder.
- main.js, game.js, field.js: update import version to avoid reusing the stale loader in cache.

Usage:
Unzip the five code files into the existing game website root, overwrite those exact files, and publish the changes. Do not delete assets/models/*.glb.
Refresh Chrome with Ctrl+Shift+R. Do not click a retry button on an old page: the changed CSP is applied only when the page loads again.

This fixes the specific console diagnostics. End-to-end deployment on the live GitHub Pages site has not been verified.
