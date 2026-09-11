# Content Library — source attribution & licensing

The toolbox-talk library (`toolbox_talks`) is bootstrapped from public safety
materials. Two sources are in use today:

| Source | Rights | Count (seed set) |
| --- | --- | --- |
| **NIOSH** (National Institute for Occupational Safety and Health) | U.S. Government work — public domain | 26 |
| **CPWR** (The Center for Construction Research and Training) | © 2017 CPWR, "all rights reserved"; free to use, **with conditions** | 8 |

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
  meeting-log PDF.

## Rule for future harvests

Every talk added to `data/processed/**` must include an `attribution` block. The
structurer agent's schema (`.claude/agents/talks/safety-structurer.md`)
documents it; `scripts/backfill-attribution.js` was the one-shot migration that
populated the original 34 and can be re-run if a talk is missing one. A talk
with no `attribution` should be treated as not ready to publish.
