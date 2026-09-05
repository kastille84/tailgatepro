const usersService = require("../services/users");

exports.createProfile = async (req, res, next) => {
  try {
    // req.userId comes from the requireAuth middleware (verified server-side
    // against the Supabase access token) — never trust an id in req.body.
    const { name, companyName, companyType } = req.body;
    const data = await usersService.createProfile({
      id: req.userId, // the connection between req.userId and this is the user's Supabase id
      name,
      companyName,
      companyType,
    });
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};
