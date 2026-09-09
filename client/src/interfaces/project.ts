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
  /** Free-text GC name, used before a GC company is linked (the invite/join flow). */
  gcNameCustom: string | null;
  status: ProjectStatus;
  /** ISO timestamp. */
  createdAt: string;
}
