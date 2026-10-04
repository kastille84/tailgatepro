// Vitest setup (see vitest.config.js `setupFiles`). Supplies inert placeholder
// env values so modules that read config at import time (e.g.
// server/utility/supabaseClient.js calls createClient() on load) can be
// required without a local .env. Only fills vars that are unset, and never uses
// real keys, so tests can't reach live Supabase/Stripe even if a mock is missed.
process.env.NODE_ENV = "test";

const placeholders = {
  SUPABASE_URL: "https://test.supabase.co",
  SUPABASE_API_KEY: "test-supabase-api-key",
  SUPABASE_SERVICE_ROLE_KEY: "test-supabase-service-role-key",
};

for (const [key, value] of Object.entries(placeholders)) {
  if (!process.env[key]) process.env[key] = value;
}
