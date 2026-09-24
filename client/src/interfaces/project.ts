/** A job site a subcontractor runs OSHA safety talks on. Mirrors the server's
 *  `toProject` output (the camelCase form of the `projects` table row). */
export type ProjectStatus = "active" | "completed";

export interface Project {
  id: string;
  /** The company that created the project (the subcontractor in the sub-led flow). */
  ownerCompanyId: string;
  name: string;
  /** The GC as a registered company, once one is linked. */
  gcCompanyId: string | null;
  /** The GC-owned jobsite this project is the sub's participation in (Phase 8d),
   *  or `null`/absent for a sub-created project. Optional because rows cached
   *  before it existed lack it. While set (with `gcCompanyId`), the GC owns the
   *  project's name. */
  jobsiteId?: string | null;
  /** Free-text GC name, used before a GC company is linked (the invite/join flow). */
  gcNameCustom: string | null;
  /** Manual GC contact email for Phase 5 PDF delivery — a stopgap until the
   *  invite/join-company flow provides a real GC account (see docs/tasks.md's
   *  Cross-cutting epic). */
  gcContactEmail: string | null;
  status: ProjectStatus;
  /** ISO timestamp when the project was archived, or `null` while it is live.
   *  Archived projects are hidden from the default list but can be restored. */
  archivedAt: string | null;
  /** ISO timestamp. */
  createdAt: string;
}
