import type { Plan } from "../interfaces/plan";

/**
 * Pricing tiers from docs/pricing-and-positioning-strategy_V2.md (§4.1 / §4.2).
 * Shared by the /pricing page and the homepage pricing teaser so the two never
 * drift. Prices are display strings, not numbers — there is no checkout yet.
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
      "Full offline PWA capabilities",
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
    annualSub: "$24/mo billed annually — save 20%",
    featured: true,
    features: [
      "Up to 8 foremen on one account",
      "Custom branding — your logo, no watermark",
      "Write and share your own custom talks",
      "Translate custom talks and read them aloud in multiple languages",
      "5-year legal archive for OSHA audits",
      "Expanded OSHA talk library",
      "AI Talk Builder",
    ],
    comingSoon: [
      "Expanded OSHA talk library",
      "AI Talk Builder",
    ],
  },
  {
    id: "trade-enterprise",
    name: "Trade Enterprise",
    target: "Large subcontractors (9+ foremen)",
    price: { monthly: "$79", annual: "$790" },
    annualSub: "$65/mo billed annually — save 20%",
    features: [
      "Unlimited foremen & crews",
      "Custom safety manual upload",
      "Procore, JobTread & QuickBooks sync",
      "Multi-crew scheduling & equipment check-ins",
    ],
    comingSoon: [
      "Custom safety manual upload",
      "Procore, JobTread & QuickBooks sync",
      "Multi-crew scheduling & equipment check-ins",
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
    ],
  },
  {
    id: "gc-site-pro",
    name: "GC Site Pro",
    target: "Single-site GCs or testing the platform",
    price: { monthly: "$149", annual: "$1,490" },
    unit: "/site",
    annualSub: "$1,490 / site billed annually — save 20%",
    features: [
      "Sponsor unlimited subcontractors on one site",
      "Automated SMS nudges — 7:00 AM every Monday (single site)",
      "Procore & Autodesk ACC sync — single project",
      "1-click OSHA Defense Bundle for the site (indexed ZIP)",
    ],
    comingSoon: [
      "Sponsor unlimited subcontractors on one site",
      "Automated SMS nudges — 7:00 AM every Monday (single site)",
      "Procore & Autodesk ACC sync — single project",
      "1-click OSHA Defense Bundle for the site (indexed ZIP)",
    ],
  },
  {
    id: "gc-portfolio",
    name: "GC Portfolio",
    target: "Regional & mid-market GCs running 4+ active projects",
    price: { monthly: "$499+", annual: "$4,990+" },
    annualSub: "$4,990/yr up to 10 sites · $7,990/yr unlimited — save 20%",
    featured: true,
    features: [
      "$499/mo up to 10 sites · $799/mo unlimited",
      "Cross-project subcontractor safety scorecards",
      "Top-down corporate policy push across all sites",
      "Multi-manager roles — Superintendent vs Safety Director",
      "Custom company safety form & manual builder",
    ],
    comingSoon: [
      "Cross-project subcontractor safety scorecards",
      "Top-down corporate policy push across all sites",
      "Multi-manager roles — Superintendent vs Safety Director",
      "Custom company safety form & manual builder",
    ],
  },
];
