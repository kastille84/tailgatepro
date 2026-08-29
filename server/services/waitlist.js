const { v4: uuidv4 } = require("uuid");
const { supabase } = require("../utility/supabaseClient");
const { AppError } = require("../utility/AppError");

// Inserts a landing-page waitlist signup. The id is generated here (the table
// has no DB default, per the project's offline-sync convention). A duplicate
// email is treated as an idempotent success rather than an error.
const addToWaitlist = async ({ name, email, company }) => {
  const { data, error } = await supabase
    .from("waitlist")
    .insert({ id: uuidv4(), name, email, company: company || null })
    .select("id, email, created_at")
    .single();

  if (error) {
    // 23505 = unique_violation on waitlist.email — already signed up.
    if (error.code === "23505") {
      return { email, alreadyJoined: true };
    }
    throw new AppError("Could not join the waitlist", 502, { cause: error });
  }

  return { ...data, alreadyJoined: false };
};

module.exports = { addToWaitlist };
