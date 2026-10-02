// Autodesk ACC adapter (Phase 9f, docs/integrations-design.md). The customer
// provisions a custom integration (APS app) in their own ACC account and
// pastes its client id/secret; we use two-legged OAuth, so TailgatePro owns
// no Autodesk app. Upload uses the Data Management API: create a storage
// object in the target folder -> signed S3 upload -> create the item/version.
const { request, requestJson } = require("./http");

const PROVIDER = "Autodesk ACC";
const APS_URL = "https://developer.api.autodesk.com";
const BUCKET_KEY = "wip.dm.prod";

/** @param {{clientId: string, clientSecret: string}} creds */
const getToken = async (creds) => {
  const basic = Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString("base64");
  const data = await requestJson(PROVIDER, `${APS_URL}/authentication/v2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials&scope=data:read data:write data:create",
  });
  return data.access_token;
};

// The Data Management API addresses ACC projects with a "b." prefix.
const dmProjectId = (projectId) => `b.${String(projectId).replace(/^b\./, "")}`;

const jsonApiHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/vnd.api+json",
});

/** Confirms the credentials can read the target folder. Throws AppError 502 if not. */
const verify = async (creds, target) => {
  const token = await getToken(creds);
  await request(
    PROVIDER,
    `${APS_URL}/data/v1/projects/${encodeURIComponent(dmProjectId(target.projectId))}/folders/${encodeURIComponent(target.folderId)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
};

/** @returns {Promise<{externalFileId: string}>} */
const push = async ({ creds, target, pdfBuffer, filename }) => {
  const token = await getToken(creds);
  const projectUrl = `${APS_URL}/data/v1/projects/${encodeURIComponent(dmProjectId(target.projectId))}`;

  const storage = await requestJson(PROVIDER, `${projectUrl}/storage`, {
    method: "POST",
    headers: jsonApiHeaders(token),
    body: JSON.stringify({
      jsonapi: { version: "1.0" },
      data: {
        type: "objects",
        attributes: { name: filename },
        relationships: {
          target: { data: { type: "folders", id: target.folderId } },
        },
      },
    }),
  });
  const storageId = storage.data.id;
  const objectName = storageId.split("/").pop();
  const signedUrl = `${APS_URL}/oss/v2/buckets/${BUCKET_KEY}/objects/${encodeURIComponent(objectName)}/signeds3upload`;
  const bearer = { Authorization: `Bearer ${token}` };

  const signed = await requestJson(PROVIDER, signedUrl, { headers: bearer });
  await request(PROVIDER, signed.urls[0], { method: "PUT", body: pdfBuffer });
  await request(PROVIDER, signedUrl, {
    method: "POST",
    headers: { ...bearer, "Content-Type": "application/json" },
    body: JSON.stringify({ uploadKey: signed.uploadKey }),
  });

  const item = await requestJson(PROVIDER, `${projectUrl}/items`, {
    method: "POST",
    headers: jsonApiHeaders(token),
    body: JSON.stringify({
      jsonapi: { version: "1.0" },
      data: {
        type: "items",
        attributes: {
          displayName: filename,
          extension: { type: "items:autodesk.bim360:File", version: "1.0" },
        },
        relationships: {
          tip: { data: { type: "versions", id: "1" } },
          parent: { data: { type: "folders", id: target.folderId } },
        },
      },
      included: [
        {
          type: "versions",
          id: "1",
          attributes: {
            name: filename,
            extension: { type: "versions:autodesk.bim360:File", version: "1.0" },
          },
          relationships: {
            storage: { data: { type: "objects", id: storageId } },
          },
        },
      ],
    }),
  });
  return { externalFileId: item.data.id };
};

module.exports = { verify, push };
