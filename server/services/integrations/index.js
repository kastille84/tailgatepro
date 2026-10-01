// Provider registry. Every adapter exposes
//   verify(creds, target) -> Promise<void>   (throws AppError 502 on failure)
//   push({ creds, target, pdfBuffer, filename }) -> Promise<{ externalFileId }>
// so adding a provider (e.g. JobTread) is one file plus one entry here.
// `target` is { projectId, folderId }.
const procore = require("./procore");
const acc = require("./acc");

const PROVIDERS = { procore, acc };

// Credential fields each provider needs; shared by validation and the
// service so the two can't drift. ACC needs a folder (Data Management API
// uploads are folder-scoped); Procore defaults to the Documents root.
const PROVIDER_FIELDS = {
  procore: { credentials: ["clientId", "clientSecret", "companyId"], folderRequired: false },
  acc: { credentials: ["clientId", "clientSecret"], folderRequired: true },
};

const PROVIDER_NAMES = Object.keys(PROVIDERS);

const getProvider = (name) => PROVIDERS[name] ?? null;

module.exports = { getProvider, PROVIDER_FIELDS, PROVIDER_NAMES };
