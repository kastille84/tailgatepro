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
 *  sent, and the server only touches the columns it receives. */
export interface UpdateProjectPatch {
  name?: string;
  status?: ProjectStatus;
  gcCompanyId?: string | null;
  gcNameCustom?: string | null;
}

const GENERIC_ERROR = "Something went wrong. Please try again.";

const authHeaders = (accessToken: string) => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${accessToken}`,
});

/** GET /api/projects — every project the caller's company owns or is the GC on. */
export const listProjects = async (
  accessToken: string,
): Promise<Project[]> => {
  const res = await fetch("/api/projects", {
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
 *  caller's company owns. */
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
