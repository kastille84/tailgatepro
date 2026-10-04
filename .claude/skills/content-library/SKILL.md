---
name: content-library
description: Build or extend the TailgatePro safety talk library by running the safety-collector (or safety-docx-importer), safety-structurer and safety-auditor agents in order. Use when the user asks to create, add to, or refresh the safety talk / toolbox talk content library.
---

# Constructing and Gathering Content Library

When user asks to create or add to the safety talk library, you will work with these agents to get the work done.
| agent | src | task |
| safety-collector | .claude/agents/talks/safety-collector.md | harvest raw safety talks from public URLs (OSHA, NIOSH, CPWR) |
| safety-docx-importer | .claude/agents/talks/safety-docx-importer.md | import talks from a local Word (.docx) library and check duplicates |
| safety-structurer | .claude/agents/talks/safety-structurer.md | convert raw files into standardized JSON |
| safety-auditor | .claude/agents/talks/safety-auditor.md | audit the processed files |

## How to Run This Workflow in Claude Code

### From public sources (URLs)

1. **Step 1:** Run `@safety-collector` to harvest raw safety talks into `data/raw/`.
2. **Step 2:** Run `@safety-structurer` to convert raw files into standardized JSON in `data/processed/`.
3. **Step 3:** Run `@safety-auditor` to audit the processed files and append compliance flags or approval status.

### From a Word document (e.g. `data/300_Toolbox_Talks_Library.docx`)

1. **Step 1:** Run `@safety-docx-importer` — `node scripts/parse-toolbox-docx.js` stages one raw file per talk plus `data/raw/_dedupe-candidates.json`; decide duplicates / out-of-scope talks in `scripts/lib/tbtCatalog.js`.
2. **Step 2:** Run `@safety-structurer` — `node scripts/build-tbt-talks.js` writes the JSON under `data/processed/<trade>/`, updates `index-by-trade.json`, and regenerates `docs/toolbox-library-import-report.md`.
3. **Step 3:** Run `@safety-auditor` on the new files (batches by trade). Only `approved` talks are seeded by `npm run seed:talks`.
