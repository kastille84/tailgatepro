import type { Plan } from "../interfaces/plan";

/**
 * Pricing tiers from docs/pricing-and-positioning-strategy_V2.md (§4.1 / §4.2).
 * Shared by the /pricing page and the homepage pricing teaser so the two never
 * drift. Prices are display strings, not numbers — the Stripe price ids live
 * server-side (`server/utility/stripePlans.js`) and the client maps plans to
 * checkout keys in `data/checkoutPlans.ts`.
 *
 * `comingSoon` lists the features (exact `features` strings) that are promised
 * but not built yet — see docs/pricing-promise-gaps.md and Phase 9 in
 * docs/tasks.md. Remove an entry from `comingSoon` when its feature ships.
 */
export const SUB_PLANS: Plan[] = [
  {
    id: "trade-free",
    name: "Trade Free",
    target: "Solo foremen",
    price: { monthly: "$0", annual: "$0" },
    features: [
      "1 user account (you)",
      "Works with no signal — saves when you're back online",
      "Core OSHA talk library",
      "Digital signatures & photo proof",
      "Auto-email PDF exports to GCs",
      "App watermark on emailed PDFs",
      "30-day in-app history",
    ],
  },
  {
    id: "trade-pro",
    name: "Trade Pro",
    target: "Growing specialty subs (2–8 foremen)",
    price: { monthly: "$29", annual: "$290" },
    annualSub: "$24/mo billed annually — 2 months free",
    featured: true,
    inheritsFrom: "Trade Free",
    features: [
      "Up to 8 foremen on one account",
      "Custom branding — your logo, no watermark",
      "Write and share your own custom talks",
      "Translate custom talks and read them aloud in multiple languages",
      "5-year legal archive, ready for OSHA inspections",
      "1-click OSHA Defense Bundle — every log in one download",
      "Expanded OSHA talk library",
      "AI Talk Builder — 10 AI-drafted talks a month",
    ],
  },
  {
    id: "trade-enterprise",
    name: "Trade Enterprise",
    target: "Large subcontractors (9+ foremen)",
    price: { monthly: "$79", annual: "$790" },
    annualSub: "$65/mo billed annually — 2 months free",
    inheritsFrom: "Trade Pro",
    features: [
      "Unlimited foremen & crews",
      "Procore & JobTread document sync",
      "AI Talk Builder — 100 AI-drafted talks a month",
    ],
  },
];

export const GC_PLANS: Plan[] = [
  {
    id: "gc-free",
    name: "GC Free Portal",
    target: "GCs receiving subcontractor safety PDFs",
    price: { monthly: "$0", annual: "$0" },
    features: [
      "1 active jobsite",
      "Dashboard with subcontractor PDFs & compliance status",
      "Basic sub roster overview",
      "1 subcontractor unlocked — others blurred",
      "Track your own in-house crews at no extra cost",
    ],
  },
  {
    id: "gc-site-pro",
    name: "GC Site Pro",
    target: "Single-site GCs or testing the platform",
    price: { monthly: "$149", annual: "$1,490" },
    unit: "/site",
    annualSub: "$1,490 / site billed annually — 2 months free",
    inheritsFrom: "GC Free Portal",
    features: [
      "Cover unlimited subcontractors on one site — they use TailgatePro free",
      "Automated SMS nudges — 7:00 AM every Monday (single site)",
      "Procore & Autodesk ACC sync — single project",
      "1-click OSHA Defense Bundle — every record for the site in one download",
    ],
  },
  {
    id: "gc-portfolio",
    name: "GC Portfolio",
    target: "Regional & mid-market GCs running 4+ active projects",
    pricePrefix: "From",
    price: { monthly: "$499", annual: "$4,990" },
    annualSub: "$4,990/yr up to 10 sites · $7,990/yr unlimited — 2 months free",
    featured: true,
    inheritsFrom: "GC Site Pro",
    features: [
      "$499/mo up to 10 sites · $799/mo unlimited",
      "Cross-project subcontractor safety scorecards",
      "Top-down corporate policy push across all sites",
      "Multi-manager roles — Superintendent vs Safety Director",
      "Custom company safety talks shared with every sub",
      "AI Talk Builder — draft a site-specific talk, then push it to every sub",
    ],
  },
];
