# Escape the usual breakfast

KINGS Café's venue-led breakfast landing page. Prepared 14 November 2026 from the latest approved design, including the slimmer phone header, full reviews and moving review section.

## Team preview

`index.html`, `assets/`, `images/` and `breakfast-menu.pdf` are the ready-to-host page. Serve this folder over HTTP; do not double-click index.html. All local links work under a nested repository path.

For a local preview, run `python3 -m http.server 8080` from the repository root, then open `http://localhost:8080/King%27s%20Cafe%20Landing%20Pages/escape-the-usual-breakfast/`.

## Edit and rebuild

From `source/`, run `npm ci`, then `npm run dev` to edit or `npm run build` to update the ready-to-host files one level above. Commit both source changes and the rebuilt files. Dependencies are locked in package-lock.json. The build script touches only this angle's generated files.

## Booking status

This is a design review build. Booking requests are not sent, and no email or SMS is delivered. The visible preview notice remains in place. The thank-you screen uses `?booking=thank-you`, which works with static hosting and browser refresh. No customer details are placed in the URL. Phone and Google Maps links work normally.

Before live bookings, implement and verify a reservation service, its data handling and confirmations. `VITE_RESERVATION_ENDPOINT` is a public frontend setting, never a place for secrets.

## GitHub publishing

This folder does not change repository settings, visibility, existing ads or deployment workflows. Add it to the existing Pages publishing artifact if one is configured; GitHub supports one Pages site per repository. If publishing from the repository root, this folder is already portable. If publishing only from `docs/` or a custom workflow, include this folder in that output before expecting a working page URL.

A source repository link displays code, not the rendered landing page. A team-only Pages website requires the organization's GitHub Enterprise Cloud plan and private Pages configuration. Confirm the actual hosting audience before publishing.

Original live variant: https://kings-cafe-breakfast-labrador.gubaraabdalla.chatgpt.site/escape-the-usual

This handoff excludes Sites project identity, Git metadata, installed dependencies, credentials and environment files.
