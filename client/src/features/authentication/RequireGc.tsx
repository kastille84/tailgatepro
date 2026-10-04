import { Navigate, Outlet } from "react-router-dom";

import { useCurrentUser } from "../../hooks/useCurrentUser";
import { StyledAuthStatus } from "./RequireAuth.styles";

/** Layout route guard for GC-only routes: render `<Route element={<RequireGc/>}>`
 *  nested inside an existing `<Route element={<RequireAuth/>}>` block (so a
 *  session is already guaranteed). Redirects a non-GC company to /dashboard
 *  rather than /login. Gated on `useCurrentUser`'s own loading state, since
 *  `companyType` isn't known until that profile query resolves. */
export const RequireGc = () => {
  const { isGc, isLoading } = useCurrentUser();

  if (isLoading) {
    return (
      <StyledAuthStatus role="status" aria-live="polite">
        Checking your access…
      </StyledAuthStatus>
    );
  }

  if (!isGc) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};
