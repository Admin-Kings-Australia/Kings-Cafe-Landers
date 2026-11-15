# KINGS Café landing pages & bookings

Campaign pages share one booking service and a private staff view at **`/bookings`**. The first integrated campaign is **Escape the usual breakfast**.

## Stage one

- Brisbane-local daily booking book, defaulting to today, with date navigation and 30-second refresh. The Today view rolls forward at midnight and refreshes when staff return to the tab.
- Guest name, email, phone, date/time, party size, guest notes, separate staff notes, and tap-to-call/email.
- Pending → confirmed / arrived / cancelled / no-show, with protection against overwriting another staff member’s newer changes.
- Daily active booking and guest totals, pending confirmations and arrivals. These are **booking counts, not physical table allocations**.
- Persistent SQLite database with customer history. Both normalized email and phone must match to link bookings; shared family contact details can still represent different people. Attended visits count only records marked Arrived.
- Campaign slug, landing path, UTM parameters and Google/Meta click IDs stored with each booking, hidden from the front-of-house list. Attribution is visitor-supplied reporting context, not verified ad conversion attribution.
- Staff password login with 12-hour, HttpOnly sessions. Guest records are never published to GitHub or embedded in the page.

## Current state

Implemented and tested; **not deployed or accepting real bookings yet**. The checked-in static campaign remains in preview mode until its endpoint is configured and rebuilt. `booking-service/Dockerfile` creates a live-capable build of the landing page and backend together. GitHub Pages alone cannot run this service or its database.

Read [booking-service/README.md](booking-service/README.md) for setup, shared form integration, backups, and the launch checklist. The existing campaign source and generated assets remain under [King's Cafe Landing Pages/escape-the-usual-breakfast](King%27s%20Cafe%20Landing%20Pages/escape-the-usual-breakfast).

## Checks

```sh
cd booking-service
npm test
```

14 tests cover persistence, Brisbane midnight, validation, retry protection, customer history, concurrent edits, authentication, CORS and the form’s success/error handling. The Vite production build passes. This execution environment refused listening sockets (`EPERM`), so browser/mobile visual and real-network end-to-end checks are still outstanding. Docker deployment has not been run here.

Email/SMS sending, automated capacity/table allocation, historical email imports and marketing dashboards are outside stage one. Staff confirm bookings by contacting guests; changing status does not send a message.
