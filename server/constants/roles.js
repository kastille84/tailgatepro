// `user_role` enum values live in Supabase_SQL.sql: 'admin' | 'safety_manager'
// | 'foreman'. MANAGER_ROLES is the subset with elevated permissions over a
// company's own data (archive/restore/delete a project, and — once the
// Cross-cutting epic's 8c/8d land — inviting teammates or subcontractor
// companies). Kept in one place so the route-level `requireRole` middleware
// and any service-layer role gate can't drift apart.
module.exports = {
  MANAGER_ROLES: ["admin", "safety_manager"],
  // Human-readable labels for the three user_role values — used in the
  // Phase 8c invite email so a role reads as "Safety Manager", not
  // "safety_manager".
  ROLE_LABELS: {
    admin: "Admin",
    safety_manager: "Safety Manager",
    foreman: "Foreman",
  },
};
