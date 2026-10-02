// Shared fetch wrapper for the Procore/ACC provider adapters. Turns every
// network failure or non-2xx into an AppError 502 (same role as callStripe in
// ../stripe.js) with the provider's own message preserved in `cause`, and
// never echoes request bodies (they carry credentials).
const { AppError } = require("../../utility/AppError");

const request = async (provider, url, options = {}) => {
  let response;
  try {
    response = await fetch(url, options);
  } catch (error) {
    throw new AppError(`Could not reach ${provider}`, 502, { cause: error });
  }
  if (!response.ok) {
    let detail = "";
    try {
      detail = (await response.text()).slice(0, 300);
    } catch {
      detail = "";
    }
    throw new AppError(
      `${provider} rejected the request (${response.status})`,
      502,
      { cause: new Error(detail || response.statusText) },
    );
  }
  return response;
};

const requestJson = async (provider, url, options) => {
  const response = await request(provider, url, options);
  return response.json();
};

module.exports = { request, requestJson };
