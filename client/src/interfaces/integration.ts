export type IntegrationProvider = "procore" | "acc";

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

export interface ConnectIntegrationInput {
  jobsiteId: string;
  provider: IntegrationProvider;
  credentials: Record<string, string>;
  projectId: string;
  folderId?: string;
}
