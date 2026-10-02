export type IntegrationProvider = "procore" | "acc" | "jobtread";

/** A connected provider on a GC jobsite or a sub's project (same shape). */
export interface JobsiteIntegration {
  id: string;
  provider: IntegrationProvider;
  externalProjectId: string;
  externalFolderId: string | null;
  status: "connected" | "error";
  lastError: string | null;
}

export interface IntegrationPush {
  id: string;
  meetingLogId: string;
  integrationId: string;
  status: "pending" | "sent" | "failed";
  error: string | null;
  attemptedAt: string;
}

/** GET /api/jobsites/:id/integrations — never includes credentials. */
export interface JobsiteIntegrationsResult {
  sitePro: boolean;
  integrations: JobsiteIntegration[];
  recentPushes: IntegrationPush[];
}

/** GET /api/projects/:id/integrations — never includes credentials. */
export interface ProjectIntegrationsResult {
  enterprise: boolean;
  integrations: JobsiteIntegration[];
  recentPushes: IntegrationPush[];
}

/** What the connect form collects; `projectId` is the provider-side project/job id. */
export interface ConnectFormValues {
  provider: IntegrationProvider;
  credentials: Record<string, string>;
  projectId: string;
  folderId?: string;
}

export interface ConnectIntegrationInput extends ConnectFormValues {
  jobsiteId: string;
}

export interface ConnectProjectIntegrationInput extends ConnectFormValues {
  /** The TailgatePro project being connected. */
  tailgateProjectId: string;
}
