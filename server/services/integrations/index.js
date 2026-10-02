// Provider registry. Every adapter exposes
//   verify(creds, target) -> Promise<void>   (throws AppError 502 on failure)
//   push({ creds, target, pdfBuffer, filename }) -> Promise<{ externalFileId }>
// so adding a provider is one file plus one entry here.
// `target` is { projectId, folderId }.
const procore = require("./procore");
const acc = require("./acc");
const jobtread = require("./jobtread");

const PROVIDERS = { procore, acc, jobtread };

// Credential fields each provider needs; shared by validation and the
// services so the two can't drift. ACC needs a folder (Data Management API
// uploads are folder-scoped); Procore defaults to the Documents root;
// JobTread attaches to the job itself.
const PROVIDER_FIELDS = {
  procore: { credentials: ["clientId", "clientSecret", "companyId"], folderRequired: false },
  acc: { credentials: ["clientId", "clientSecret"], folderRequired: true },
  jobtread: { credentials: ["grantKey"], folderRequired: false },
};

// Which providers each side may connect: GC jobsites (Site Pro) and
// subcontractor projects (Trade Enterprise).
const GC_PROVIDERS = ["procore", "acc"];
const SUB_PROVIDERS = ["procore", "jobtread"];

const getProvider = (name) => PROVIDERS[name] ?? null;

module.exports = { getProvider, PROVIDER_FIELDS, GC_PROVIDERS, SUB_PROVIDERS };
