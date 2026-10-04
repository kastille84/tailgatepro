/**
 * Marketing copy used on both the homepage and /pricing. Keep it here so the
 * two pages can't drift (they previously disagreed on sponsored access).
 */

export const NO_INSTALL_ANSWER =
  "No. Foremen tap a link and TailgatePro opens right in the phone's browser — nothing to install. It keeps working with no signal and sends everything once the phone is back online.";

export const SPONSORED_ACCESS_QUESTION =
  "How does a general contractor cover subcontractors for free?";

export const SPONSORED_ACCESS_ANSWER =
  "A general contractor (GC) invites subcontractors to a jobsite by email or shares a company join code, and their talks show up on the GC's dashboard. On a GC Site Pro site or any GC Portfolio site, every subcontractor on the job gets full Trade Pro access at no cost to them.";

export const NO_PER_USER_FEES_TITLE = "No per-user fees";

/** Callout body as text runs; `strong` runs are emphasised. */
export const NO_PER_USER_FEES_BODY: { text: string; strong?: boolean }[] = [
  {
    text: "Many safety apps charge for every user, so adding subcontractors to your project costs you more. With ",
  },
  { text: "GC Site Pro", strong: true },
  { text: " or " },
  { text: "GC Portfolio", strong: true },
  { text: " you pay one flat rate per site or portfolio, and " },
  { text: "subcontractors on your job never pay a fee", strong: true },
  { text: " — no app-store downloads and no user-billing disputes." },
];
