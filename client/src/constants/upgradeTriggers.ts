import { GC_PLANS } from "../data/plans";

/**
 * Upsell copy for the six hard conversion triggers in
 * docs/pricing-and-positioning-strategy_V2.md §6. Kept out of the components so
 * the wording lives in one place. Modals complement the inline banners; they
 * never replace them.
 */
export type UpgradeTrigger =
  | "second-foreman"
  | "history-lockout"
  | "sub-blur"
  | "fourth-site"
  | "policy-push"
  | "scorecard";

export interface UpgradeParams {
  /** `sub-blur`: how many subcontractors are logging on the site. */
  subCount?: number;
  /** `sub-blur`: the jobsite's name. */
  siteName?: string;
  /** `sub-blur`: the jobsite the purchase would apply to. */
  jobsiteId?: string;
}

export interface UpgradeCopy {
  title: string;
  body: string;
  cta: string;
}

const priceOf = (planId: string): number => {
  const plan = GC_PLANS.find((p) => p.id === planId);
  return Number.parseInt((plan?.price.monthly ?? "0").replace(/\D/g, ""), 10);
};

export const SITE_PRO_MONTHLY = priceOf("gc-site-pro");
export const PORTFOLIO_MONTHLY = priceOf("gc-portfolio");
/** What three separate Site Pro sites cost — the "$447" in the 4th-site prompt. */
export const THREE_SITES_MONTHLY = SITE_PRO_MONTHLY * 3;

export const getUpgradeCopy = (
  trigger: UpgradeTrigger,
  params: UpgradeParams = {},
): UpgradeCopy => {
  switch (trigger) {
    case "second-foreman":
      return {
        title: "Deploying multiple crews?",
        body: "Upgrade to Trade Pro ($29/mo) to manage up to 8 foremen under one account.",
        cta: "Upgrade to Trade Pro",
      };
    case "history-lockout":
      return {
        title: "Protect your business during an OSHA audit",
        body: "Unlock your full 5-year legal cloud archive for $29/mo.",
        cta: "Unlock the archive",
      };
    case "sub-blur": {
      const count = params.subCount ?? 2;
      const site = params.siteName ?? "your site";
      return {
        title: "More subcontractors are logging safety talks",
        body: `${count} Subcontractors are actively logging safety talks on ${site}. Upgrade to GC Site Pro to unlock full multi-sub compliance.`,
        cta: "Upgrade to GC Site Pro",
      };
    }
    case "fourth-site":
      return {
        title: "Adding another site?",
        body: `You are currently paying $${THREE_SITES_MONTHLY}/mo for 3 individual sites. Upgrade to GC Portfolio ($${PORTFOLIO_MONTHLY}/mo) for flat-rate coverage across up to 10 active projects. Your Site Pro subscriptions are cancelled and the unused time is credited.`,
        cta: "Upgrade to GC Portfolio",
      };
    case "policy-push":
      return {
        title: "Enforce safety topics company-wide",
        body: "Want to enforce mandatory company-wide safety topics across all projects simultaneously? Upgrade to GC Portfolio.",
        cta: "Upgrade to GC Portfolio",
      };
    case "scorecard":
      return {
        title: "Cross-project subcontractor scorecards",
        body: "Unlock Cross-Project Subcontractor Safety Scorecards to evaluate trade safety performance across your entire portfolio.",
        cta: "Upgrade to GC Portfolio",
      };
  }
};
