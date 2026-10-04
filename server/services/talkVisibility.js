// Namespaced require (not destructured) so a test's vi.spyOn on subAccess is
// picked up regardless of require order -- same convention policyPush.js uses.
const { hasFullLibrary } = require("../utility/entitlements");
const subAccessService = require("./subAccess");

// The visibility options talksService.listForCompany / getById take for a
// caller (docs/company-talks-design.md): whether the plan sees the whole
// global library (Trade Free is core-only, Phase 9c), plus -- for a
// subcontractor -- the GCs it currently works for, whose custom talks it may
// see and log. A GC needs no extra ids: its own talks are already covered by
// its own company id. `user` is req.user from loadUserContext.
const resolveTalkVisibility = async (user) => ({
  fullLibrary: hasFullLibrary(user.companyType, user.tier),
  gcCompanyIds:
    user.companyType === "subcontractor"
      ? await subAccessService.listAcceptedGcIds(user.companyId)
      : [],
});

module.exports = { resolveTalkVisibility };
