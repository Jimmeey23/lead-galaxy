# Momence session renewal

Lead Galaxy uses the login + TOTP MFA flow from the existing Momence login script. Both lead edits and follow-up updates use the same server-side session manager.

Copy `.env.example` to `.env.local` and set:

- `MOMENCE_EMAIL`: existing Momence account email
- `MOMENCE_PASSWORD`: existing account password
- `MOMENCE_TOTP_SECRET`: base32 shared secret for that account's existing authenticator
- `MOMENCE_ALL_COOKIES`: optional initial cookie string
- `MOMENCE_HOST_ID`: studio host ID

Restart the development server after changing credentials. Never prefix these variables with `NEXT_PUBLIC_`.

When cookies are missing, the next Momence request logs in and completes TOTP MFA. An HTTP 401/403 or redirect to a login page renews the cookies and retries the original request once. Other HTTP errors are returned without retry. Concurrent requests within one server process share one renewal. Failed renewals have a one-minute cooldown to avoid repeated login attempts. Renewal happens on demand, not on a background timer.

Successful renewal updates `process.env.MOMENCE_ALL_COOKIES` immediately and atomically replaces that entry in this project's `.env.local`, preserving other settings and comments. The file is owner-readable/writable only. Credentials, generated codes, response bodies, and cookies are not logged or returned by the settings endpoint.

Local persistence requires a writable project directory. Set `MOMENCE_PERSIST_ENV=false` to disable file updates. Vercel automatically skips file persistence: runtime cookies stay in the warm process only, and deployment environment variables are not changed. Each cold process can log in again using configured credentials. Use shared secret/session storage if deployment-wide durable renewal is needed.

Run `node scripts/test-momence-auth.cjs` for mocked authentication, retry, cookie normalization, concurrency, and file-persistence checks. Tests do not contact Momence or modify lead records.
