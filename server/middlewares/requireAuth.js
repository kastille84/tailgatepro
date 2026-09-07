const { supabase } = require("../utility/supabaseClient");
const { AppError } = require("../utility/AppError");

// Verifies a Supabase access token sent as `Authorization: Bearer <token>` using
// the server's service-role client. Attaches the verified user id to req.userId.
// Controllers must use req.userId for any write to "the current user's" row —
// never an id supplied in the request body, or a client could write another
// user's data.
const requireAuth = async (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return next(new AppError("Authentication required", 401));
  }

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) {
    return next(new AppError("Invalid or expired session", 401));
  }

  req.userId = data.user.id;
  // `user_metadata` is set by the client at sign-up and is user-editable, so
  // it's only safe for non-authorization display fields (name, company). The
  // row id still comes from req.userId, and privileged fields like `role` are
  // server-defaulted — never trust anything in here for access control.
  req.userMetadata = data.user.user_metadata ?? {};
  return next();
};

module.exports = { requireAuth };
