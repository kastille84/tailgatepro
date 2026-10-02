// JobTread adapter (Trade Enterprise sub-side, docs/integrations-design.md).
// The customer creates a grant key in their own JobTread organization and pastes
// it in; TailgatePro owns no JobTread app. The Pave API is a single POST
// endpoint with the grant key inside the request body (not a header). Upload is
// createUploadRequest -> PUT the bytes -> createFile attached to the job.
// `target.projectId` is the JobTread job id; there is no folder concept.
// NOTE: field names follow secondary sources only and are unverified against a
// live account (see the design doc's live-verification list). Keep them here.
const { request, requestJson } = require("./http");

const PROVIDER = "JobTread";
const PAVE_URL = "https://api.jobtread.com/pave";

const pave = async (grantKey, query) => {
  const data = await requestJson(PROVIDER, PAVE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: { $: { grantKey }, ...query } }),
  });
  return data;
};

/** Confirms the grant key is valid and can read the job. Throws AppError 502 if not. */
const verify = async (creds, target) => {
  await pave(creds.grantKey, {
    job: { $: { id: target.projectId }, id: {}, name: {} },
  });
};

/** @returns {Promise<{externalFileId: string}>} */
const push = async ({ creds, target, pdfBuffer, filename }) => {
  const upload = await pave(creds.grantKey, {
    createUploadRequest: {
      $: { size: pdfBuffer.length, type: "application/pdf" },
      createdUploadRequest: { id: {}, url: {}, method: {}, headers: {} },
    },
  });
  const uploadRequest = upload.createUploadRequest.createdUploadRequest;

  await request(PROVIDER, uploadRequest.url, {
    method: uploadRequest.method || "PUT",
    headers: uploadRequest.headers || { "Content-Type": "application/pdf" },
    body: pdfBuffer,
  });

  const created = await pave(creds.grantKey, {
    createFile: {
      $: {
        name: filename,
        uploadRequestId: uploadRequest.id,
        targetId: target.projectId,
        targetType: "job",
      },
      createdFile: { id: {} },
    },
  });
  return { externalFileId: String(created.createFile.createdFile.id) };
};

module.exports = { verify, push };
