// `user_role` enum values live in Supabase_SQL.sql: 'admin' | 'safety_manager'
// | 'foreman' | 'superintendent'. MANAGER_ROLES is the company-wide subset with
// elevated permissions over a company's own data (archive/restore/delete a
// project, create/archive a jobsite, and — once the Cross-cutting epic's
// 8c/8d land — inviting teammates or subcontractor companies). `superintendent`
// (GC Portfolio, Phase 9d-2) is deliberately NOT in it: it is scoped to its
// assigned jobsites, so every company-level `requireRole(...MANAGER_ROLES)`
// gate excludes it. Kept in one place so the route-level `requireRole`
// middleware and any service-layer role gate can't drift apart.
const MANAGER_ROLES = ["admin", "safety_manager"];

module.exports = {
  MANAGER_ROLES,
  // Roles that may act on a jobsite (invite/remove a subcontractor): the
  // company-wide managers plus a superintendent, whose reach is limited to
  // assigned sites by services/siteScope.js.
  SITE_MANAGER_ROLES: [...MANAGER_ROLES, "superintendent"],
  // The one role whose jobsite visibility is limited to `jobsite_members` rows.
  SITE_SCOPED_ROLE: "superintendent",
  // Human-readable labels for the user_role values — used in the Phase 8c
  // invite email so a role reads as "Safety Director", not "safety_manager".
  ROLE_LABELS: {
    admin: "Admin",
    safety_manager: "Safety Director",
    foreman: "Foreman",
    superintendent: "Superintendent",
  },
};
