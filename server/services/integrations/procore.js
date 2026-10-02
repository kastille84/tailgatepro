// Procore adapter (Phase 9f, docs/integrations-design.md). The customer's
// admin creates a Developer Managed Service Account in their own Procore
// company and pastes its client id/secret; we use the client-credentials
// grant, so TailgatePro owns no Procore app. Upload follows PRD 6.1:
// request upload instructions -> send bytes to the returned storage URL ->
// attach the upload to the project's Documents tool.
const { request, requestJson } = require("./http");

const PROVIDER = "Procore";
const LOGIN_URL = "https://login.procore.com/oauth/token";
const API_URL = "https://api.procore.com";

/** @param {{clientId: string, clientSecret: string}} creds */
const getToken = async (creds) => {
  const data = await requestJson(PROVIDER, LOGIN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
    }),
  });
  return data.access_token;
};

const apiHeaders = (token, creds) => ({
  Authorization: `Bearer ${token}`,
  "Procore-Company-Id": String(creds.companyId),
});

/** Confirms the credentials can reach the project. Throws AppError 502 if not. */
const verify = async (creds, target) => {
  const token = await getToken(creds);
  await request(
    PROVIDER,
    `${API_URL}/rest/v1.0/projects/${encodeURIComponent(target.projectId)}?company_id=${encodeURIComponent(creds.companyId)}`,
    { headers: apiHeaders(token, creds) },
  );
};

/** @returns {Promise<{externalFileId: string}>} */
const push = async ({ creds, target, pdfBuffer, filename }) => {
  const token = await getToken(creds);
  const headers = apiHeaders(token, creds);

  // The upload instructions are valid for one hour and only usable by the
  // user who created them, so all steps run in this one call.
  const upload = await requestJson(
    PROVIDER,
    `${API_URL}/rest/v1.1/projects/${encodeURIComponent(target.projectId)}/uploads`,
    {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        response_filename: filename,
        response_content_type: "application/pdf",
      }),
    },
  );

  const form = new FormData();
  Object.entries(upload.fields || {}).forEach(([key, value]) =>
    form.append(key, value),
  );
  form.append("file", new Blob([pdfBuffer], { type: "application/pdf" }), filename);
  await request(PROVIDER, upload.url, { method: "POST", body: form });

  const file = await requestJson(
    PROVIDER,
    `${API_URL}/rest/v1.0/files?project_id=${encodeURIComponent(target.projectId)}`,
    {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        file: {
          name: filename,
          upload_uuid: upload.uuid,
          ...(target.folderId ? { parent_id: Number(target.folderId) } : {}),
        },
      }),
    },
  );
  return { externalFileId: String(file.id) };
};

module.exports = { verify, push };
