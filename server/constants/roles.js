// `user_role` enum values live in Supabase_SQL.sql: 'admin' | 'safety_manager'
// | 'foreman'. MANAGER_ROLES is the subset with elevated permissions over a
// company's own data (archive/restore/delete a project, and — once the
// Cross-cutting epic's 8c/8d land — inviting teammates or subcontractor
// companies). Kept in one place so the route-level `requireRole` middleware
// and any service-layer role gate can't drift apart.
module.exports = {
  MANAGER_ROLES: ["admin", "safety_manager"],
};
