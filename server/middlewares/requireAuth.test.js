// Plain CommonJS, no ESM `import` — this project's server code is CJS, and a
// nested require() inside another CJS file (requireAuth.js -> supabaseClient.js)
// only reliably shares Node's module cache with this test's own requires when
// this file is loaded the same way (require, not import) as everything it
// pulls in. Mixing `import` here with requireAuth.js's internal `require()`
// produces two separate module instances and silently defeats any mocking.
// `describe`/`it`/`expect`/`vi`/etc. come from Vitest's `globals: true`
// (vitest.config.js) since `require("vitest")` itself isn't supported.
const { supabase } = require("../utility/supabaseClient");
const { requireAuth } = require("./requireAuth");

// Spy once, at module scope — the shared `supabase` object's `.auth.getUser`
// is looked up fresh at call time inside requireAuth.js, so reconfiguring the
// same spy's return value per test (rather than repeated spyOn/restore
// cycles) is simplest and avoids any re-binding surprises.
const getUserSpy = vi.spyOn(supabase.auth, "getUser");

describe("requireAuth", () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    getUserSpy.mockReset();
    req = { headers: {} };
    res = {};
    next = vi.fn();
  });

  it("should call next with a 401 AppError when no Authorization header is present", async () => {
    // Arrange
    // req.headers.authorization left unset

    // Act
    await requireAuth(req, res, next);

    // Assert
    expect(getUserSpy).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    const error = next.mock.calls[0][0];
    expect(error.statusCode).toBe(401);
    expect(error.message).toBe("Authentication required");
  });

  it("should call next with a 401 AppError when the header isn't a Bearer token", async () => {
    // Arrange
    req.headers.authorization = "Basic sometoken";

    // Act
    await requireAuth(req, res, next);

    // Assert
    expect(getUserSpy).not.toHaveBeenCalled();
    const error = next.mock.calls[0][0];
    expect(error.statusCode).toBe(401);
  });

  it("should call next with a 401 AppError when Supabase rejects the token", async () => {
    // Arrange
    req.headers.authorization = "Bearer bad-token";
    getUserSpy.mockResolvedValue({
      data: { user: null },
      error: new Error("invalid token"),
    });

    // Act
    await requireAuth(req, res, next);

    // Assert
    expect(getUserSpy).toHaveBeenCalledWith("bad-token");
    const error = next.mock.calls[0][0];
    expect(error.statusCode).toBe(401);
    expect(error.message).toBe("Invalid or expired session");
  });

  it("should attach req.userId and call next() with no error when the token is valid", async () => {
    // Arrange
    req.headers.authorization = "Bearer good-token";
    getUserSpy.mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });

    // Act
    await requireAuth(req, res, next);

    // Assert
    expect(req.userId).toBe("user-123");
    expect(next).toHaveBeenCalledWith();
  });
});
