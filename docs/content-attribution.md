# Content Library — source attribution & licensing

The toolbox-talk library (`toolbox_talks`) is built from public safety materials plus one
owner-supplied Word library. As of 2026-09-25 (seeded to both non-prod and prod), 112 talks:

| Source | Rights | Count |
| --- | --- | --- |
| **OSHA** | U.S. Government work — public domain | 38 |
| **NIOSH** (National Institute for Occupational Safety and Health) | U.S. Government work — public domain | 29 |
| **CPWR** (The Center for Construction Research and Training) | © CPWR, "all rights reserved"; free to use, **with conditions** | 19 |
| **EPA** | U.S. Government work — public domain | 3 |
| **TailgatePro** (original talks written from OSHA / NIOSH / EPA pages) | `original-work` — see below | 20 |
| **TailgatePro Library** (owner-supplied Word document) | `owner-provided-unverified` — see below | 3 |

## Why CPWR talks need special handling

CPWR's Toolbox Talks are distributed free for jobsite training but are **not**
public-domain federal works. Using them inside an application is permitted only
when all three of these hold:

1. **No standalone resale.** CPWR's free resources may not be repackaged and sold
   as a standalone paid product. TailgatePro bundles the talks as one feature of
   a subscription product and never sells individual talks — satisfied by design.
2. **Attribution.** CPWR/NIOSH branding and copyright markings must stay with the
   content wherever it is shown.
3. **No implied endorsement.** The product must not state or imply that CPWR or
   NIOSH endorses TailgatePro, the company, or its services.

## How the app satisfies conditions 2 and 3

Every talk — CPWR **and** NIOSH, for consistency — carries an `attribution`
object, stored in `data/processed/<trade>/<slug>.json` and loaded verbatim into
the `toolbox_talks.attribution` JSONB column:

```json
"attribution": {
  "source": "CPWR",
  "publisher": "CPWR — The Center for Construction Research and Training",
  "copyright": "© 2017 CPWR — The Center for Construction Research and Training. All rights reserved.",
  "license": "free-use-with-attribution",
  "source_url": "https://www.cpwr.com/wp-content/uploads/...",
  "notice": "Adapted from a CPWR/NIOSH Toolbox Talk, produced under NIOSH cooperative agreement OH 009762. Reproduced with attribution for jobsite safety training; not an endorsement by CPWR or NIOSH."
}
```

- `license` is `free-use-with-attribution` for CPWR, `public-domain` for NIOSH.
- Every `notice` ends with "not an endorsement by CPWR or NIOSH".
- The seed loader (`scripts/lib/talkRow.js` `composeMarkdown`) also appends
  `copyright` + `notice` to the talk's Markdown `content`, so the credit travels
  into the Phase 5 PDF and any plain-text render even if a surface forgets to
  read the structured field.

### Display obligations (enforced downstream)

- **Phase 2c `TalkDetail`** must render `attribution.copyright` and
  `attribution.notice` on any screen that shows a talk's body.
- **Phase 5 PDF service** must print the same credit on the generated
  meeting-log PDF. ✅ Implemented in `server/services/pdfGeneration.js`, which
  prints `attribution.copyright` + `attribution.notice` beneath the talk
  content. How the finished PDF reaches the GC by email is documented in
  `docs/meeting-flow-design.md` under "Phase 5 hook point".

## Talks rebuilt from agency sources (Word-library replacements)

Where the Word library's talk was boilerplate, the talk was rebuilt from a real agency source found on an allowed
domain only (`osha.gov`, `cdc.gov/niosh`, `epa.gov`, `cpwr.com`, state `.gov`). These talks carry the agency's own
`attribution` (OSHA and EPA: `license: "public-domain"`, U.S. Government work; NIOSH as above; CPWR as above) plus
`source_ref: "TBT-NNN"` linking back to the Word-library number. Commercial toolbox-talk sites are never used. Some CPWR
PDFs are marked "All rights reserved" / "verify reuse terms"; the free-use-with-attribution conditions above still
apply, and the auditor flags them individually.

**Not usable: OSHA Susan Harwood grantee materials.** OSHA hosts training materials written by grant recipients
(`osha.gov/harwoodgrants`, `obis.osha.gov/dte/grant_materials`). They are the grantee's copyright, not U.S. Government
works, and OSHA's page permits reuse "solely for non-commercial, instructional, personal, or scholarly purposes" with
"no fee", and prohibits "any modification" without the owner's written permission. A paid product that adapts the text
cannot meet that, so none of these are used (three were found and removed: sheet-metal gas cylinders, drill press
trainer script, slips/trips/falls handout).

## Original TailgatePro talks (written from OSHA / NIOSH / EPA sources)

Where no agency talk existed for a Word-library topic, TailgatePro wrote an original talk from the governing
regulation or agency guidance page (source files in `data/authored/`, built by `scripts/build-authored-talks.js`).
Their `attribution` is `source: "TailgatePro"`, `license: "original-work"`, `source_url` = the primary page read,
`source_ref: "TBT-NNN"`, and a `notice` naming the source and ending "Not an endorsement by OSHA / NIOSH / EPA."
Regulation and agency text is a U.S. Government work in the public domain; the wording is TailgatePro's own, so
these carry no third-party copyright. Each was checked claim-by-claim against the pages it cites before approval;
unverified general advice is prefixed "Good practice:".

## Owner-provided talks (Word library)

Talks imported from `data/300_Toolbox_Talks_Library.docx` (see
`docs/toolbox-library-import-report.md`) are not CPWR/NIOSH content and carry no agency copyright. Their
`attribution` is `source: "TailgatePro Library"`, `license: "owner-provided-unverified"`, `source_url: null`,
`source_ref: "TBT-NNN"`, with a `notice` that makes no CPWR/NIOSH claim. The source document names no author or
license, so **confirm rights before publishing** (tracked in `docs/tasks.md` Phase 10). The "notice ends with *not
an endorsement by CPWR or NIOSH*" rule above applies to CPWR/NIOSH talks only.

## Rule for future harvests

Every talk added to `data/processed/**` must include an `attribution` block. The
structurer agent's schema (`.claude/agents/talks/safety-structurer.md`)
documents it; `scripts/backfill-attribution.js` was the one-shot migration that
populated the original 34 and can be re-run if a talk is missing one. A talk
with no `attribution` should be treated as not ready to publish.
