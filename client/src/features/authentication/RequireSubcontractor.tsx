import { Navigate, Outlet } from "react-router-dom";

import { useCurrentUser } from "../../hooks/useCurrentUser";
import { StyledAuthStatus } from "./RequireAuth.styles";

/** Layout route guard for subcontractor-only routes (e.g. Toolbox Talks —
 *  GCs don't run meetings or author talk content): render
 *  `<Route element={<RequireSubcontractor/>}>` nested inside an existing
 *  `<Route element={<RequireAuth/>}>` block (so a session is already
 *  guaranteed). Redirects a GC company to /dashboard, the inverse of
 *  `RequireGc`. Gated on `useCurrentUser`'s own loading state, since
 *  `companyType` isn't known until that profile query resolves. */
export const RequireSubcontractor = () => {
  const { isGc, isLoading } = useCurrentUser();

  if (isLoading) {
    return (
      <StyledAuthStatus role="status" aria-live="polite">
        Checking your access…
      </StyledAuthStatus>
    );
  }

  if (isGc) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};
