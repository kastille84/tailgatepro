import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useAuth } from "../context/auth";
import { uploadCompanyLogo } from "../services/apiCompanies";
import type { Company } from "../interfaces/company";

/**
 * Wraps the company-logo upload mutation. Unlike crew photos/signatures,
 * this deliberately does NOT go through the offline sync outbox — uploading
 * a company logo is a one-off office/admin action from the Settings page,
 * not part of the connectivity-unreliable job-site meeting flow the outbox
 * exists for (confirmed with the user; see docs/tasks.md's Phase 5e
 * follow-up plan). A direct `useMutation` keeps this simple.
 */
export const useUploadCompanyLogo = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const mutation = useMutation<Company, Error, Blob>({
    mutationFn: (blob) => uploadCompanyLogo(session!.access_token, blob),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companyLogo"] });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return {
    uploadLogo: (blob: Blob) => mutation.mutateAsync(blob),
    isUploading: mutation.isPending,
  };
};
