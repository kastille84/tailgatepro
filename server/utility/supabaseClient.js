const { createClient } = require("@supabase/supabase-js");
const { keysBasedOnEnv } = require("./envUtils");

// The single server-side Supabase client. Uses the service-role key, so it
// bypasses RLS — never expose it to the browser. Sessions are disabled since
// the server authenticates per-request, not via a persisted Supabase session.
const { url, serviceRoleKey } = keysBasedOnEnv().supabase;

const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

module.exports = { supabase };
