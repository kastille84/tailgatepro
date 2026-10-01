import { fetchWithTimeout } from "../utils/fetchWithTimeout";
import type {
  ConnectIntegrationInput,
  IntegrationProvider,
  JobsiteIntegration,
  JobsiteIntegrationsResult,
} from "../interfaces/integration";

const GENERIC_ERROR = "Something went wrong. Please try again.";

const authHeaders = (accessToken: string) => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${accessToken}`,
});

/** Unwraps the server's `{ success, data }` envelope, throwing its message. */
const unwrap = async <T>(res: Response): Promise<T> => {
  const body = await res.json().catch(() => null);

  if (!res.ok || !body?.success) {
    throw new Error(body?.error ?? GENERIC_ERROR);
  }

  return body.data as T;
};

/** GET /api/jobsites/:id/integrations — connected providers + recent pushes. */
export const listJobsiteIntegrations = async (
  accessToken: string,
  jobsiteId: string,
): Promise<JobsiteIntegrationsResult> => {
  const res = await fetchWithTimeout(`/api/jobsites/${jobsiteId}/integrations`, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return unwrap<JobsiteIntegrationsResult>(res);
};

/** PUT /api/jobsites/:id/integrations/:provider — the server verifies the
 *  credentials against the provider before storing them (encrypted). */
export const connectIntegration = async (
  accessToken: string,
  { jobsiteId, provider, credentials, projectId, folderId }: ConnectIntegrationInput,
): Promise<JobsiteIntegration> => {
  const res = await fetchWithTimeout(
    `/api/jobsites/${jobsiteId}/integrations/${provider}`,
    {
      method: "PUT",
      headers: authHeaders(accessToken),
      body: JSON.stringify({ credentials, projectId, folderId }),
    },
  );
  return unwrap<JobsiteIntegration>(res);
};

/** DELETE /api/jobsites/:id/integrations/:provider */
export const disconnectIntegration = async (
  accessToken: string,
  jobsiteId: string,
  provider: IntegrationProvider,
): Promise<void> => {
  const res = await fetchWithTimeout(
    `/api/jobsites/${jobsiteId}/integrations/${provider}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  await unwrap<null>(res);
};

/** POST /api/integrations/pushes/:id/retry — re-sends a failed PDF push. */
export const retryIntegrationPush = async (
  accessToken: string,
  pushId: string,
): Promise<{ status: "sent" | "failed" }> => {
  const res = await fetchWithTimeout(`/api/integrations/pushes/${pushId}/retry`, {
    method: "POST",
    headers: authHeaders(accessToken),
  });
  return unwrap<{ status: "sent" | "failed" }>(res);
};
