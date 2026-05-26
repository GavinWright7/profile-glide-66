# Admin Map

Private, local-only dashboard for viewing discoverable user locations on a US map. This tool is **not** part of the production mobile app.

## Setup

1. Generate an admin secret (run once):

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. Add the value to **Railway → Variables** as `ADMIN_SECRET_KEY`.

3. Add the same value to your local `server/.env`:

   ```
   ADMIN_SECRET_KEY=your_generated_hex_string
   ```

4. Copy `map.html` into this folder if you don't have it yet (the file is gitignored and stays on your machine only).

## Usage

1. Open `admin/map.html` directly in your browser (double-click the file).
2. Enter your `ADMIN_SECRET_KEY` when prompted — it is stored in `localStorage` after the first entry.
3. The map auto-refreshes every 10 seconds.
4. Click **Logout** to clear the stored key and reload.
5. To reset manually: open the browser console and run `localStorage.clear()`, then reload.

## Security

- Never commit `map.html` with a key filled in, and never share your admin key.
- The `/admin/*` API routes require the `x-admin-key` header and return **403** without a valid key.
- Admin routes are rate-limited to 60 requests per minute per IP.
- The map-data endpoint returns only public profile fields needed for the map — no JWTs, emails, or internal user IDs.

## API

```
GET https://reliable-connection-production.up.railway.app/admin/map-data
Header: x-admin-key: <ADMIN_SECRET_KEY>
```

Response:

```json
{
  "users": [...],
  "count": 3,
  "fetchedAt": "2026-05-26T12:00:00.000Z"
}
```
