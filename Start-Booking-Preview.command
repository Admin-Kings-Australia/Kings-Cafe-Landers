#!/bin/bash
set -euo pipefail

# Run on your Mac: starts an isolated test copy, not the live website.
TASK_ROOT="$(cd "$(dirname "$0")" && pwd)"
PREVIEW_ROOT="$TASK_ROOT/.booking-preview"
SOURCE_ROOT="$PREVIEW_ROOT/source"
REPOSITORY='https://github.com/Admin-Kings-Australia/Kings-Cafe-Landers.git'
BRANCH='codex/shared-booking-system'
BOOKING_PID=''
finish() {
  if [ -n "$BOOKING_PID" ]; then kill "$BOOKING_PID" 2>/dev/null || true; fi
}
trap finish EXIT INT TERM
failure() { echo; echo 'Preview could not start. Copy the error above back into ChatGPT.'; read -r -p 'Press Return to close. ' _; }
trap failure ERR

printf '\nKINGS CAFÉ — LOCAL BOOKING TEST\n\n'
command -v node >/dev/null || { echo 'Node.js 22.13 or later is required.'; exit 1; }
node -e 'const [a,b]=process.versions.node.split(".").map(Number);if(a<22||(a===22&&b<13))throw Error("Node 22.13 or later is required")'
command -v git >/dev/null
mkdir -p "$PREVIEW_ROOT/data"
printf "*\n" > "$PREVIEW_ROOT/.gitignore"
chmod 700 "$PREVIEW_ROOT" "$PREVIEW_ROOT/data"
if [ ! -d "$SOURCE_ROOT/.git" ]; then
  echo 'Downloading the booking-test branch…'
  git clone --branch "$BRANCH" --single-branch "$REPOSITORY" "$SOURCE_ROOT"
else
  echo 'Using the existing isolated preview copy.'
fi
LANDING_SOURCE="$SOURCE_ROOT/King's Cafe Landing Pages/escape-the-usual-breakfast/source"
cd "$LANDING_SOURCE"
echo 'Preparing the breakfast page…'
npm ci --no-audit --no-fund
VITE_RESERVATION_ENDPOINT=/api/bookings ./node_modules/.bin/vite build
mkdir -p "$SOURCE_ROOT/booking-service/landing"
cp -R dist/. "$SOURCE_ROOT/booking-service/landing/"

export STAFF_PASSWORD="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(18).toString("base64url"))')"
export DATABASE_PATH="$PREVIEW_ROOT/data/bookings.sqlite"
export HOST=127.0.0.1 PORT=4174 NODE_ENV=development
export ALLOWED_ORIGINS=http://localhost:4174
cd "$SOURCE_ROOT/booking-service"
# Refuse to open another app that is already using our preview port.
node -e 'const s=require("node:net").createServer();s.on("error",()=>{console.error("Port 4174 is already in use. Close the previous booking preview first.");process.exit(1)});s.listen(4174,"127.0.0.1",()=>s.close())'
node server.mjs &
BOOKING_PID=$!
READY=false
for attempt in 1 2 3 4 5 6 7 8 9 10; do
  if curl --silent --fail http://localhost:4174/bookings >/dev/null; then READY=true; break; fi
  kill -0 "$BOOKING_PID" 2>/dev/null || { echo 'The booking server stopped unexpectedly.'; exit 1; }
  sleep 1
done
[ "$READY" = true ] || { echo 'The booking server did not become ready.'; exit 1; }
printf '\nReady — use fictional customer details for this test.\n\n'
printf 'Breakfast page: http://localhost:4174/escape-the-usual-breakfast/\n'
printf 'Staff page:     http://localhost:4174/bookings\n'
printf 'Staff password: %s\n\n' "$STAFF_PASSWORD"
printf 'Choose tomorrow if today’s breakfast service has ended.\n'
printf 'Submit the form, then select the same date on the staff page.\n'
printf 'Keep this Terminal window open. Press Control+C to stop.\n'
printf 'Test bookings stay in the local .booking-preview/data directory.\n\n'
open http://localhost:4174/escape-the-usual-breakfast/
open http://localhost:4174/bookings
wait "$BOOKING_PID"
