# Document integrations — Procore + Autodesk ACC (Phase 9f)

Status: built against mocked provider HTTP; **not yet exercised against a live Procore or ACC account**
(no developer credentials; see "Live verification").

## What it does

A GC manager (admin / safety manager) connects **one jobsite** to **their own** Procore project and/or
Autodesk ACC folder. After that, every sealed meeting-log PDF for any project linked to that jobsite is
pushed into the connected project's Documents automatically. A failed push is recorded and can be
retried from the jobsite's Integrations modal.

Gated to Site Pro access (`hasSiteProAccess`: the jobsite's own `site_pro` plan, or the GC on Portfolio).
The push step re-checks this each time, so a lapsed subscription stops pushing without a disconnect.

## Bring-your-own credentials

TailgatePro owns **no** Procore or Autodesk developer app. The customer's admin creates the credentials in
their own account and pastes them in:

| Provider | Customer creates | We store (encrypted) | Also needed | Auth |
| :--- | :--- | :--- | :--- | :--- |
| Procore | Developer Managed Service Account with access to the project | client id, client secret, company id | project id; folder id optional (Documents root by default) | OAuth 2.0 client-credentials |
| ACC | Custom integration (APS app) added to their ACC account | client id, client secret | project id and **folder id (required)** | APS two-legged OAuth |

Credentials are verified against the provider (`adapter.verify`) before anything is stored, so a typo fails
immediately with the provider's status in the message. They are AES-256-GCM encrypted
(`server/utility/secretBox.js`, key `INTEGRATIONS_ENCRYPTION_KEY[_PROD]`, 32 bytes base64) and are never
returned to the client — the list endpoint returns provider, project, folder, status and last error only.

## Data model (`Supabase_SQL.sql` section 17)

- `jobsite_integrations` — one row per (jobsite, provider): ids, `encrypted_credentials`, `status`
  (`connected` | `error`), `last_error`.
- `integration_pushes` — one row per (meeting log, integration), UNIQUE so a push is idempotent:
  `status` (`pending` | `sent` | `failed`), `external_file_id`, `filename`, `error`.
- `meeting_log_audit_events.event_type` gains `integration_pushed` (existing databases need the ALTER at
  the end of section 17).

Both tables are server-only (RLS on, no policies).

## Flow

1. `pdfGenerationQueue.enqueue` renders and stores the PDF, records `pdf_generated`, then calls
   `jobsiteIntegrations.pushMeeting({ meetingLogId, jobsiteId: project.jobsiteId, pdfBuffer, filename })`.
2. `pushMeeting` (soft-fail, never throws) checks Site Pro access, loads the jobsite's integrations and runs
   one push per provider in parallel. Each attempt upserts the `integration_pushes` row, updates the
   integration's `status`/`last_error`, and records an `integration_pushed` audit event on success.
3. Provider adapters (`server/services/integrations/{procore,acc}.js`, registry in `index.js`):
   - **Procore:** token → `POST /rest/v1.1/projects/{id}/uploads` → multipart POST of the bytes to the
     returned storage URL → `POST /rest/v1.0/files` with `upload_uuid` (and `parent_id` if a folder is set).
     The upload instructions expire in an hour and only work for the creating user, so all steps run in one call.
   - **ACC:** token → create storage in the folder → signed S3 upload (PUT, then finalize) → create item +
     version in the folder.
4. Retry (`POST /api/integrations/pushes/:id/retry`) re-reads the PDF from the `meeting-pdfs` bucket and
   re-runs the same push.

Projects not linked to a jobsite (`projects.jobsite_id` null) are not pushed.

## API (manager-only, GC company, site-scoped)

- `GET    /api/jobsites/:id/integrations`
- `PUT    /api/jobsites/:id/integrations/:provider` — `{ credentials, projectId, folderId? }`
- `DELETE /api/jobsites/:id/integrations/:provider`
- `POST   /api/integrations/pushes/:id/retry`

## Adding a provider (JobTread, etc.)

One adapter file exposing `verify(creds, target)` and `push({ creds, target, pdfBuffer, filename })`, one entry
in `integrations/index.js` (`PROVIDERS` + `PROVIDER_FIELDS`), one entry in the `provider` CHECK constraint, and
one entry in `client/src/data/integrationProviders.ts`.

## Decisions and limits

- **Scope:** Procore and ACC only. JobTread is deferred. QuickBooks was dropped (2026-10-01): accounting has
  no document-folder equivalent for a safety PDF, so it is a poor fit.
- **No queue:** there is no persistent job queue in this codebase. A push that fails is recorded as `failed`
  and surfaced with a Retry button; nothing retries automatically.
- **Trade Enterprise** (sub-side) is covered by the "Sub-side" section below.- **Secrets:** losing or rotating `INTEGRATIONS_ENCRYPTION_KEY` makes stored credentials undecryptable;
  affected integrations show as `error` on the next push and must be reconnected.

## Sub-side: Trade Enterprise (Procore + JobTread)

A subcontractor manager on **Trade Enterprise** (`hasTradeEnterpriseAccess`, company tier) connects one of their
TailgatePro **projects** (`projects.id`) to their own Procore project or JobTread job. Same bring-your-own-credentials
model and encryption as the GC side; each sealed PDF for the project is pushed automatically, with a manual Retry.

- **Independent of the GC push.** A project linked to a GC jobsite that has its own integration pushes to *both*; neither
  suppresses the other. Each side files the PDF in its own system.
- **Tables** (`Supabase_SQL.sql` section 18): `project_integrations` (UNIQUE project + provider) and
  `project_integration_pushes` (UNIQUE meeting + integration). Separate from the jobsite tables to keep their FKs intact.
- **Shared engine:** `integrations/pushRunner.js` runs one attempt (decrypt, adapter push, record outcome, audit event)
  for both sides, parameterised by table names; `jobsiteIntegrations.js` and `projectIntegrations.js` are thin wrappers.
- **Providers per side:** `GC_PROVIDERS = procore, acc`; `SUB_PROVIDERS = procore, jobtread` (`integrations/index.js`);
  each route validates only its own side.
- **JobTread** (`integrations/jobtread.js`): customer creates an API grant key in their JobTread organization. Pave API,
  one `POST https://api.jobtread.com/pave` with the grant key in the request body; verify = read the job;
  push = `createUploadRequest`, PUT the bytes, `createFile` attached to the job (the pasted job id). No folder concept.
- **Gating:** `connect` and `retryPush` return 403 `PLAN_REQUIRED` unless the caller is on Trade Enterprise; `pushMeeting`
  re-checks the owning company at push time so a lapsed plan stops pushing. The client shows an upgrade prompt.
- **API** (sub managers only): `GET|PUT|DELETE /api/projects/:id/integrations[/:provider]`,
  `POST /api/project-integrations/pushes/:id/retry`.

## Live verification (open)

Provider request shapes follow each vendor's public API docs but were not run against a live account. Before
announcing: with a customer or sandbox, connect each provider, complete a meeting, confirm the PDF lands in
the folder, force a failure (revoke the service account) and confirm Retry after reconnecting.

**JobTread is the least certain:** its Pave field names (`createUploadRequest`, `createFile` and its target fields) were taken
from secondary sources because the official docs could not be fetched. They live only in `integrations/jobtread.js`.
