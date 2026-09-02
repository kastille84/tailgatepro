# Assistant Instructions for TailgatePro

Purpose

- Provide concise, repo-aware guidance and edits for the TailgatePro codebase.

Scope

- Apply by default to the entire workspace. Call out exceptions when a rule is file- or folder-specific.

Key Rules (draft)

- Follow existing project style and conventions; prefer minimal, surgical changes.
- Use TypeScript/React idioms in `client/` and Node.js / Express idioms in `server/`.
- Do not reformat entire files unless explicitly requested.
- When editing code: run only the smallest change needed to fix the issue.
- Add tests only when the change introduces new behavior or fixes a bug that benefits from regression protection. _Important:_ do not use jest, only vitest for unit testing. See `docs/unit-testing.md` for details.
- Avoid introducing new major dependencies without prior approval.

Communication & Clarifications

- Keep responses concise and action-oriented. When making edits, summarize what changed and why.
- If a rule is ambiguous, ask one targeted clarifying question before making the change.

Examples (prompts to use)

- "Apply the project's TypeScript patterns and fix the type error in `client/src/utils/EnvUtils.tsx`."
- "Refactor `server/routes` to use async/await; keep behavior identical and add a unit test for the changed route."

Ambiguities / Questions for the maintainer

1. Should the rules apply uniformly across `client/` and `server/`, or treat them separately? (recommended: separate)

- rules should treat client and server separately, as they have different idioms and conventions

2. Do you prefer Prettier/ESLint autoformatting as part of PRs, or manual formatting only when requested?

- Manual formatting only when requested

3. Any banned/required dependencies or specific coding patterns to avoid?

- none

## Docs folder

The `docs/` folder contains markdown files that refer to different aspects of the codebase. **IMPORTANT** always check the `docs/` folder for relevant information before making changes to the codebase. DO NOT SKIP THIS STEP. If you find a discrepancy between the code and the docs, please flag it for review. The table below lists the files in the `docs/` folder and their purpose.

| type    | file                                | purpose                                                                             |
| ------- | ----------------------------------- | ----------------------------------------------------------------------------------- |
| general | folder-structure.md                 | This file describes the the folder structure and what files are in each.            |
| general | prd.md                              | This file describes the product requirements and design for TailgatePro.            |
| error   | error-handling.md                   | This file describes the error handling standards for TailgatePro.                   |
| coding  | coding-style.md                     | This file describes the coding standards for TailgatePro.                           |
| unit    | unit-testing.md                     | This file describes the unit testing standards for TailgatePro.                     |
| design  | ui-styling.md                       | This file describes the UI styling standards for TailgatePro.                       |
| design  | responsive.md                       | This file describes the mobile-first & responsive design standards for TailgatePro. |
| ui      | ui-inputs.md                        | This file describes the UI input standards for TailgatePro.                         |
| auth    | auth.md                             | This file describes the authentication standards for TailgatePro.                   |
| pricing | pricing-and-positioning-strategy.md | This file describes the pricing and positioning strategy for TailgatePro.           |
