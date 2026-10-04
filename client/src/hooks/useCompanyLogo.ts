import { useQuery } from "@tanstack/react-query";

import { useAuth } from "../context/auth";
import { getCompanyLogoUrl } from "../services/apiCompanies";

/**
 * A short-lived signed URL for the caller's own company logo, or `null` if
 * none has been uploaded yet. Disabled until a session exists, same as
 * `useTalks`/`useCurrentUser`.
 */
export const useCompanyLogo = () => {
  const { session } = useAuth();

  const query = useQuery({
    queryKey: ["companyLogo"],
    queryFn: () => getCompanyLogoUrl(session!.access_token),
    enabled: !!session,
  });

  return {
    logoUrl: query.data ?? null,
    isLoading: query.isLoading,
  };
};
