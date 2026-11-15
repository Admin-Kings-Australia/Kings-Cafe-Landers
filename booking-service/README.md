# KINGS booking book

A small Node.js service with SQLite storage and a responsive staff page. No backend npm dependencies. Requires Node 22.13+ (tested on 22.23.1); Node 22 still labels its built-in SQLite module experimental.

## Run locally

From `booking-service/`:

```sh
export STAFF_PASSWORD='replace-with-a-unique-long-password'
export ALLOWED_ORIGINS='http://localhost:4174'
npm start
```

Open `http://localhost:4174/bookings`. Set `DATABASE_PATH` to choose storage; default is `./data/bookings.sqlite`. No sample guests are inserted. For local Vite form testing, add its exact origin to `ALLOWED_ORIGINS` and set `VITE_RESERVATION_ENDPOINT=http://localhost:4174/api/bookings` in the campaign’s ignored `.env.local`, then restart Vite. Use test contacts only while verifying.

## Deploy the landing page and bookings together

From the **repository root**, build with:

```sh
docker build -f booking-service/Dockerfile -t kings-bookings .
```

Run this image on one Node/container host behind HTTPS, attach a **persistent volume at `/data`**, and provide `STAFF_PASSWORD` (unique, 16+ characters) and `ALLOWED_ORIGINS` (exact HTTPS origin of your site). The image listens on port 4174. Use the host’s secret settings, not frontend variables or committed files. Mount ownership must allow the container’s `node` user (UID 1000) to write.

Routes:

| URL | Purpose |
| --- | --- |
| `/` | Redirect to the breakfast campaign |
| `/escape-the-usual-breakfast/` | Existing landing page, built with `/api/bookings` enabled |
| `/bookings` | Staff sign-in and daily guest list |
| `/api/bookings` | Shared form endpoint (POST); staff daily list (GET) |

Use one running instance with one durable disk. Do not use ephemeral/serverless disk or multiple replicas with separate databases. For multiple writers/replicas, migrate to managed PostgreSQL. The service does not arrange hosting, a domain, backups or HTTPS automatically.

Alternatively keep landing pages on their current host, point their `VITE_RESERVATION_ENDPOINT` to `https://YOUR-BOOKING-HOST/api/bookings`, and allow each landing-page origin. Serve staff page and staff API on the same host so secure session cookies work. If you want `/bookings` on the original domain, route `/bookings`, `/bookings/*` and `/api/*` to this service through that domain’s reverse proxy, or host the supplied combined image there. GitHub Pages has no reverse-proxy or Node runtime.

`NODE_ENV=production` makes staff cookies Secure: HTTPS is required. `TRUST_PROXY=true` is only for a trusted proxy that overwrites `X-Forwarded-For`; otherwise leave false. Without it, rate limits apply to the proxy’s IP, which may group visitors together. Tune deployment rate limits after testing real traffic. Current limits are 10 staff login attempts and 30 booking submissions per IP per 15 minutes; limits reset on restart. Internet exposure should include the host’s standard request/body/time limits and abuse controls.

## Connect any campaign

Send JSON to `POST /api/bookings`, with `Content-Type: application/json` and `Idempotency-Key: <unique UUID>`. Keep the same key and identical payload when retrying an uncertain response; use a new key after changing details. The supplied React integration keeps this key while the form stays open/in memory; refreshing the page loses it, so staff should check possible duplicates if a customer reports a retry after reload.

```json
{
  "name": "Test Guest",
  "email": "guest@example.com",
  "phone": "+61412345678",
  "date": "2027-01-15",
  "time": "09:00",
  "guests": 3,
  "notes": "Birthday breakfast",
  "attribution": {
    "campaign": "escape-the-usual-breakfast",
    "landing_path": "/escape-the-usual-breakfast/",
    "utm_source": "facebook",
    "utm_medium": "paid_social",
    "utm_campaign": "skip-the-usual-breakfast",
    "utm_content": "creative-03"
  }
}
```

Successful response: `201 {"id":"...","status":"pending","replayed":false}`. An identical retry returns 200 and the existing ID/status. Do not show a successful submission or fire a conversion until a valid saved receipt returns. No customer details go in the thank-you URL. Attribution captures landing-time parameters only; no ad pixels, ad-platform uploads or marketing consent are introduced.

Current rules mirror the existing form: 1–12 guests, half-hour slots 07:00–11:30 Brisbane time, future times within the next 366 days. These are **request slots, not capacity/availability guarantees**. Confirm service hours with the café before launch. All requests require staff confirmation. Notes limit is 1,000 characters; private staff notes 2,000. Local Australian numbers are normalized to +61; international numbers need a country code.

## Staff use

1. Sign in and check today’s list. Change the date for future or past bookings.
2. Tap Call, or open Details for email, guest requests and booking history.
3. Set Confirmed after contacting the guest. Set Arrived when they attend. Cancellation/no-show removes them from active totals.
4. Add staff notes and save. If another device changed the booking, close Details, refresh and reopen before editing again.

History matches the exact normalized email + phone pair. A changed phone or email creates a separate customer record; no fuzzy merging. Booking count includes cancellations; attended count includes only Arrived. Campaign information remains in the database for the later reporting project. Staff sign-in uses a shared café password in stage one; individual accounts and per-person audit trails are not included. To revoke all sessions when rotating the password, stop the service and delete records from the `sessions` table before restart (or let sessions expire within 12 hours).

## Backup and retention

Back up the SQLite database daily using SQLite’s online backup API or a volume snapshot that is consistent with SQLite WAL, and store backups privately outside the runtime disk. Copying only the `.sqlite` file while the service is running can miss WAL writes. A simple maintenance backup is: stop the service, copy the entire `/data` directory, restart. Test restoring a backup to a separate instance before going live. Never commit database files or real booking fixtures.

Choose a retention period and restricted backup access with the owner before accepting customer data. There is no automated deletion schedule or export UI in this stage. Remove test bookings from the production database before launch; do not delete a database that already holds real bookings.

## Launch checklist

- Host and domain selected; persistent disk mounted and backup/restore tested.
- HTTPS, strong staff password and origin allowlist configured; confirm staff can sign in on phones/tablet.
- Confirm 07:00–11:30 request times and 12-guest maximum; review customer privacy wording and retention.
- Submit a test via the real landing page; verify one saved booking, Brisbane date, notes and campaign tags.
- Retry an identical request; verify no duplicate. Confirm another device sees it within 30 seconds.
- Test call/email links, status changes, refresh, login expiry, midnight rollover and outage recovery.
- Remove test records and distribute the staff URL/password privately.

## Verification

`npm test`: 14 passing checks. Landing-page `npm run build`: passed. UI script syntax check: passed. Tests invoke the actual HTTP handler using streams, without opening a listening socket. Browser/device QA and deployed end-to-end/Docker checks remain unverified because this environment denied local listening (`EPERM`). No live deployment or customer messaging was performed.
