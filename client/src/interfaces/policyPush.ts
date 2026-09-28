/** The GC's current top-down policy push (Phase 9e,
 *  docs/policy-push-design.md), or "nothing pushed" when every field is
 *  `null`. Mirrors `policyPush.js`'s `getCurrentPush` return shape. */
export interface PolicyPushState {
  talkId: string | null;
  talkTitle: string | null;
  pushedAt: string | null;
  pushedByName: string | null;
}

/** One sub's compliance against the currently pushed topic, on one jobsite. */
export interface PolicyPushSubStatus {
  companyId: string;
  companyName: string | null;
  status: "logged" | "missing";
  lastLoggedAt: string | null;
}

/** One active jobsite's roster and their compliance against the current push. */
export interface PolicyPushJobsite {
  id: string;
  name: string;
  subs: PolicyPushSubStatus[];
}

/** `GET /api/gc/policy-push` response body: the current push state plus,
 *  when one is active, a per-active-jobsite compliance rollup since it was
 *  pushed. `jobsites`/`totals` are empty/zeroed when nothing is pushed. */
export interface PolicyPushCompliance extends PolicyPushState {
  jobsites: PolicyPushJobsite[];
  totals: {
    subs: number;
    logged: number;
    missing: number;
  };
}

/** One row of `GET /api/gc/policy-push/talks` — the push picker's options
 *  (global talks only; see docs/policy-push-design.md "Gating"). */
export interface PolicyPushTalkOption {
  id: string;
  title: string;
  tradeTag: string | null;
}
