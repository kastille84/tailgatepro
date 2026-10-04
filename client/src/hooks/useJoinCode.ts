import { useQuery } from "@tanstack/react-query";

import { useAuth } from "../context/auth";
import { getJoinCode } from "../services/apiCompanies";
import { useCurrentUser } from "./useCurrentUser";

/**
 * The GC's own join code (`GET /api/companies/join-code`), which its
 * subcontractors enter to link a project. Only enabled for a GC company — the
 * endpoint 403s for anyone else, so a subcontractor never fires the request.
 * The server creates the code on first request.
 */
export const useJoinCode = () => {
  const { session } = useAuth();
  const { isGc } = useCurrentUser();

  const query = useQuery({
    queryKey: ["joinCode"],
    queryFn: () => getJoinCode(session!.access_token),
    enabled: !!session && isGc,
  });

  return {
    joinCode: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
  };
};
