import type { IntegrationProvider } from "../interfaces/integration";

export interface IntegrationFieldConfig {
  /** Key inside the `credentials` object sent to the server. */
  name: "clientId" | "clientSecret" | "companyId" | "grantKey";
  label: string;
  secret?: boolean;
}

export interface IntegrationProviderConfig {
  provider: IntegrationProvider;
  label: string;
  /** Where the customer's admin gets the credentials below. */
  help: string;
  credentialFields: IntegrationFieldConfig[];
  projectLabel: string;
  /** False when the provider attaches to the project/job itself (JobTread). */
  hasFolder: boolean;
  folderLabel: string;
  folderRequired: boolean;
}

// Mirrors PROVIDER_FIELDS in server/services/integrations/index.js. The
// customer supplies credentials from their OWN Procore/ACC/JobTread account --
// TailgatePro owns no developer app (docs/integrations-design.md).
export const INTEGRATION_PROVIDERS: IntegrationProviderConfig[] = [
  {
    provider: "procore",
    label: "Procore",
    help: "In Procore, an admin creates a Developer Managed Service Account and gives it access to the project. Paste its Client ID and Secret below.",
    credentialFields: [
      { name: "clientId", label: "Client ID" },
      { name: "clientSecret", label: "Client secret", secret: true },
      { name: "companyId", label: "Procore company ID" },
    ],
    projectLabel: "Procore project ID",
    hasFolder: true,
    folderLabel: "Documents folder ID (optional)",
    folderRequired: false,
  },
  {
    provider: "acc",
    label: "Autodesk ACC",
    help: "In Autodesk, an account admin adds a custom integration to your ACC account. Paste its Client ID and Secret below.",
    credentialFields: [
      { name: "clientId", label: "Client ID" },
      { name: "clientSecret", label: "Client secret", secret: true },
    ],
    projectLabel: "ACC project ID",
    hasFolder: true,
    folderLabel: "Folder ID",
    folderRequired: true,
  },
  {
    provider: "jobtread",
    label: "JobTread",
    help: "In JobTread, an organization admin creates an API grant key. Paste it below with the ID of the job these reports belong to.",
    credentialFields: [{ name: "grantKey", label: "Grant key", secret: true }],
    projectLabel: "JobTread job ID",
    hasFolder: false,
    folderLabel: "",
    folderRequired: false,
  },
];

const pick = (providers: IntegrationProvider[]) =>
  INTEGRATION_PROVIDERS.filter((config) => providers.includes(config.provider));

// Which providers each side can connect; mirrors GC_PROVIDERS / SUB_PROVIDERS
// in server/services/integrations/index.js.
export const GC_INTEGRATION_PROVIDERS = pick(["procore", "acc"]);
export const SUB_INTEGRATION_PROVIDERS = pick(["procore", "jobtread"]);
