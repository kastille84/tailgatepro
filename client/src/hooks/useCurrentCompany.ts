import { useQuery } from "@tanstack/react-query";

import { useAuth } from "../context/auth";
import { getMyCompany } from "../services/apiCompanies";

/**
 * The caller's own company profile (`GET /api/companies/me`), layered on
 * `useAuth()` the same way `useCurrentUser` is — its own domain hook rather
 * than merged into `AuthProvider`. Disabled until a session exists.
 */
export const useCurrentCompany = () => {
  const { session } = useAuth();

  const query = useQuery({
    queryKey: ["currentCompany"],
    queryFn: () => getMyCompany(session!.access_token),
    enabled: !!session,
  });

  return {
    company: query.data ?? null,
    isLoading: query.isLoading,
  };
};
