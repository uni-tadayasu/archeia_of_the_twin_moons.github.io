Riftfall Arena / Arkeia - In-game Gifts and System Mail
2026-11-07 | updated files only

1) Deploy the Web game files at the same paths:
   index.html            (updated menu and cache version)
   main.js               (mailbox integration and server-confirmed reward import)
   mailbox.js            (new; player inbox and chief-only send/history UI)
   mailbox.css           (new; dialog styling)

2) Deploy server/worker.js to the EXISTING Cloudflare Worker.
   Do not deploy it as a second Worker. Do not delete Durable Objects.
   It keeps the eight existing exported Durable Object classes, including MailStore.
   Keep your existing server/wrangler.toml, Secrets and bindings.
   The existing config must have the binding:
     name = "MAIL_STORE"
     class_name = "MailStore"
   and the existing migration: v4-mail / MailStore.
   Use Wrangler from the server directory if code-editor deployment cannot
   resolve Durable Object bindings, e.g. npx wrangler deploy (with the proper account).

3) In-game controls:
   Main menu -> 受信箱: View your player ID; receive, read and claim gifts.
   After entering the verified chief key: Main menu -> 運営長の配信管理.
   Tabs: プレゼント配信 / システムメール / 送信履歴.
   Recipient: All / One player ID / Group of up to 40 player IDs.
   Group IDs: comma, spaces or newlines. Every selected target must have
   registered an account via the in-game sync feature.

4) The server owns mail records, gift receipts and player currency/inventory.
   Claiming again with the same message ID does not award twice.
   Recipients do not need to be online; they receive mail on their next inbox check.
   Global mail is available to sync-registered players for the chosen period.
   The mail box does NOT send external emails to an email address.

5) Back up the current files and Worker settings before deployment.
   No GLB models, sound assets, data.js, or existing player saves are changed.
   Validation performed locally; real Cloudflare deployment still needs verification.
