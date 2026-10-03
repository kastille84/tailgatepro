# AI Talk Builder Design (Phase 9e)

Status: **decided, v1 built** (manual verify + `ANTHROPIC_API_KEY` provisioning pending). Plan:
`~/.claude/plans/let-s-look-at-the-vectorized-wilkinson.md`. See `docs/tasks.md` 9e and
`docs/pricing-promise-gaps.md`.

## Scope

A user types a hazard/topic; the server asks Claude for a structured toolbox talk; the client pre-fills
`TalkForm` with it. **Nothing is saved by the generation call** — the user reviews/edits and saves through
the existing `POST /api/talks`, so a draft never reaches a crew without a human pass.

Not built (v1): grounding in the global library / retrieval, a second AI audit pass, "adapt an existing
talk", an "AI draft then push to every sub" one-click flow for GCs, and cloud "AI voice".

## Who gets it

| Plan | Drafts / month |
|---|---|
| Trade Free, GC Free, GC Site Pro | 0 (upgrade note in the form) |
| Trade Pro | 10 |
| Trade Enterprise | 100 |
| GC Portfolio | 100 (a GC draft reaches every sub; GC role gate unchanged: admin/safety_manager) |

`PLAN_LIMITS[...].aiGenerationsPerMonth` in `server/utility/entitlements.js` is the single source; access
is "limit > 0" (`hasAiTalkBuilderAccess`). The client mirrors plan ids in `useCurrentUser`
(`hasAiTalkBuilderAccess`, UI only). Enterprise's higher cap is its upgrade lever and offsets LLM spend.
Numbers are starting values — tune after seeing real usage.

## Server

- `POST /api/talks/generate` `{ topic (3-300), tradeTag? }` → `{ draft, usage }`; `GET /api/talks/ai-usage`
  → `{ used, limit, remaining }`. Both registered before `GET /:id`. Order of checks in the controller:
  plan/role to author (`assertCanAuthor`), then AI allowance (403), then cap (429, `data.code: "PLAN_LIMIT"`).
- `server/services/talkGeneration.js`: model `claude-sonnet-5-5`, **structured outputs**
  (`output_config.format` json_schema) — not forced tool use, which that model rejects. The prompt tells the
  model the topic is data, not instructions, and to leave `oshaStandards` empty rather than guess a citation.
  The result is re-validated against the same limits as the create-talk route (a valid draft is always
  saveable); any structural problem is a masked 502 with the reason kept in `cause`.
- Key unset → 503 "unavailable" (`translation.js` pattern). `ANTHROPIC_API_KEY[_PROD]` in `envUtils.js`.
- **Cap:** table `ai_talk_generations` (`id` server-generated UUID, `company_id`, `user_id`, `created_at`);
  the cap counts this company's rows since the start of the UTC month. A row is inserted only after a valid
  draft, so failures cost nothing. Check-then-insert is not atomic: two simultaneous requests at the last
  slot can both succeed (at most a draft or two over cap) — accepted for v1.

## Client

`apiTalkGeneration.ts` → `useGenerateTalk.ts` (TanStack `useMutation`/`useQuery`, deliberately **not** the
offline outbox — generation is online-only). `TalkForm` shows a "Draft with AI" panel in **create mode
only**: topic input, button (disabled under 3 chars or at 0 remaining), "N of M drafts left", an upgrade or
offline note in place of the input, and a persistent "AI-drafted — verify against OSHA" banner after a draft
is applied. The draft overwrites the content fields only (`reset` keeps `targetLanguages`).

## Known limitations

- No rate limit beyond the monthly cap (per-user throttle not added).
- No quiz is generated (custom talks have none today either).
- The draft is not checked against the OSHA standards database; accuracy rests on the human review step
  and the banner.
- `getUsage` + insert race (above).
