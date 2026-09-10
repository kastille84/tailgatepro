import type { Project, ProjectStatus } from "../interfaces/project";

/** Fields accepted when creating a project. The `id` is generated inside
 *  `createProject` (a client-side UUID, per the offline-sync rule), not supplied
 *  by the caller. Exactly one of `gcCompanyId` / `gcNameCustom` must be set — the
 *  server enforces this, and the form only offers `gcNameCustom` for now. */
export interface CreateProjectInput {
  name: string;
  gcCompanyId?: string | null;
  gcNameCustom?: string | null;
}

/** Fields that can be patched on an existing project. Only the keys present are
 *  sent, and the server only touches the columns it receives. `archived: true`
 *  archives the project; `false` restores it. */
export interface UpdateProjectPatch {
  name?: string;
  status?: ProjectStatus;
  gcCompanyId?: string | null;
  gcNameCustom?: string | null;
  archived?: boolean;
}

const GENERIC_ERROR = "Something went wrong. Please try again.";

const authHeaders = (accessToken: string) => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${accessToken}`,
});

/** GET /api/projects — every project the caller's company owns or is the GC on.
 *  Archived projects are omitted unless `includeArchived` is set. */
export const listProjects = async (
  accessToken: string,
  { includeArchived = false }: { includeArchived?: boolean } = {},
): Promise<Project[]> => {
  const query = includeArchived ? "?includeArchived=true" : "";
  const res = await fetch(`/api/projects${query}`, {
    method: "GET",
    headers: authHeaders(accessToken),
  });

  const body = await res.json().catch(() => null);

  if (!res.ok || !body?.success) {
    throw new Error(body?.error ?? GENERIC_ERROR);
  }

  return body.data as Project[];
};

/**
 * POST /api/projects — create a project. The `id` is generated here (not on the
 * server) so a project created offline keeps the same primary key when it later
 * syncs, per `Supabase_Schema.md`'s offline-sync note.
 */
export const createProject = async (
  accessToken: string,
  input: CreateProjectInput,
): Promise<Project> => {
  const res = await fetch("/api/projects", {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify({ id: crypto.randomUUID(), ...input }),
  });

  const body = await res.json().catch(() => null);

  if (!res.ok || !body?.success) {
    throw new Error(body?.error ?? GENERIC_ERROR);
  }

  return body.data as Project;
};

/** PATCH /api/projects/:id — patch name / status / GC fields on a project the
 *  caller's company owns. `patch.archived` archives (`true`) or restores (`false`). */
export const updateProject = async (
  accessToken: string,
  id: string,
  patch: UpdateProjectPatch,
): Promise<Project> => {
  const res = await fetch(`/api/projects/${id}`, {
    method: "PATCH",
    headers: authHeaders(accessToken),
    body: JSON.stringify(patch),
  });

  const body = await res.json().catch(() => null);

  if (!res.ok || !body?.success) {
    throw new Error(body?.error ?? GENERIC_ERROR);
  }

  return body.data as Project;
};

/** DELETE /api/projects/:id — hard-delete a project the caller's company owns.
 *  The server rejects this with a 409 (surfaced as the thrown message) once the
 *  project has logged safety talks; archive it instead. */
export const deleteProject = async (
  accessToken: string,
  id: string,
): Promise<{ id: string }> => {
  const res = await fetch(`/api/projects/${id}`, {
    method: "DELETE",
    headers: authHeaders(accessToken),
  });

  const body = await res.json().catch(() => null);

  if (!res.ok || !body?.success) {
    throw new Error(body?.error ?? GENERIC_ERROR);
  }

  return body.data as { id: string };
};
