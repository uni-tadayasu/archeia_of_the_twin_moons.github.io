ARKEIA model fetch repair - 2026-11-07

Copy index.html, main.js, game.js, field.js, model-runtime.js and model-transport.js
into the root folder of your EXISTING published project. Do not delete assets/models.
Publish changes and hard-refresh the page (Ctrl+Shift+R).

Important: All original assets/models/*.glb files must already be published
at that site's exact root or project subdirectory. This update does not
contain the large original GLB files.

If models still fail, click "モデルの公開URLを確認" in the error panel.
If the URL shows 404, upload the entire assets/models directory from
your original project. If it shows a browser privacy/CORS block,
copy the exact URL and error message to identify the host configuration.

The patch uses document.baseURI instead of the transient JS module URL,
with a fetch-to-XHR fallback; no changes to your saves or server.
