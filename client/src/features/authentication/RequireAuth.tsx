import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "../../context/auth";
import { StyledAuthStatus } from "./RequireAuth.styles";

/** Layout route guard: render `<Route element={<RequireAuth/>}>` wrapping any
 *  number of protected `<Route>` children. Gated on `loading` so an already
 *  authenticated user refreshing a protected page never flash-redirects to
 *  /login before their session is confirmed. */
export const RequireAuth = () => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <StyledAuthStatus role="status" aria-live="polite">
        Checking your session…
      </StyledAuthStatus>
    );
  }

  if (!user) {
    // `from` lets Login send the user back here afterwards (e.g. the emailed
    // report link at /gc/meetings/:id/report).
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  return <Outlet />;
};
