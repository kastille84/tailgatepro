# Data Access Model

Status: decided (Phase 0, post-Auth build). Applies to every table in
`Supabase_SQL.sql` except `auth.*`.

## Decision: server-brokered access, RLS deny-all

All application reads and writes go through the Express API. The browser never talks to
PostgreSQL directly for domain data.

- **Row Level Security stays enabled with no policies on every table.** `waitlist` already does
  this; `companies`, `users`, `projects`, `project_subcontractors`, `toolbox_talks`,
  `meeting_logs`, and `signatures` follow the same rule. With RLS on and no policy, the public
  `anon` key (the key the client bundles for Supabase Auth) is denied all table access.
- **The server uses the service-role key** via the single client in
  `server/utility/supabaseClient.js`, which bypasses RLS. Every endpoint that touches domain data
  sits behind `requireAuth` (verifies the Supabase access token, sets `req.userId`) and, from
  Phase 1 on, `loadUserContext` (loads `req.user = { id, companyId, role }` from the `users`
  table). Authorization — "is this row in the caller's company?" — is enforced in the service
  layer, not the database.
- **The client keeps using Supabase only for auth** (`context/auth/auth-provider.ts`): sign-in,
  session, `onAuthStateChange`, password reset. It reads `session.access_token` and sends it as
  `Authorization: Bearer <token>` to the API (see `services/apiUsers.ts`).

## Why not client-direct with RLS policies

Client-direct Supabase access with real RLS policies is the other common pattern and is less code
for simple CRUD. It was not chosen because:

1. **Offline sync (Phase 3) needs one write path.** The plan is an IndexedDB queue that replays
   writes when connectivity returns. Funnelling every write through the API keeps queue-and-replay,
   conflict handling, `synced_at` stamping, and server-side PDF generation in a single place. Two
   write paths (some direct, some queued) would be a persistent source of drift.
2. **It matches the code that already exists.** `waitlist` and `users` are already server-brokered
   with the service-role client and the `AppError` / `{ success, data }` conventions. Keeping one
   model avoids a split-brain data layer.
3. **Authorization rules here are relational, not row-local.** "A GC may read a subcontractor's
   meeting logs for a shared project" spans `project_subcontractors`, `projects`, and
   `meeting_logs`. That is more readable as service-layer code than as recursive RLS policies,
   especially before the invite/join-company flow exists.

## Consequences / rules for new features

- Add a `routes/ → controllers/ → services/` trio per domain. The service does all Supabase
  calls and all "does this belong to the caller's company?" checks.
- Never add a Supabase call to the client outside `context/auth/`.
- Do not write RLS policies. If a future feature genuinely needs client-direct access (e.g. a
  Supabase Realtime subscription), that is a deliberate revisit of this decision, documented here.
- Storage buckets (Phase 4) follow the same idea: private buckets, the server issues signed URLs.
