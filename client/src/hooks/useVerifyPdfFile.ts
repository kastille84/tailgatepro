import { useMutation } from "@tanstack/react-query";

import { checkPublicPdfHash } from "../services/apiPublicVerify";
import { sha256File } from "../utils/sha256File";
import type { PdfFileCheck } from "../interfaces/meetingLog";

/**
 * Hashes a dropped PDF in the browser and asks the server whether that digest
 * is one it generated for this meeting. Only the 64-character hex digest
 * crosses the network, never the document.
 */
export const useVerifyPdfFile = (meetingId: string | undefined) => {
  const mutation = useMutation<PdfFileCheck, Error, File>({
    networkMode: "always",
    mutationFn: async (file) =>
      checkPublicPdfHash(meetingId!, await sha256File(file)),
  });

  return {
    checkFile: mutation.mutate,
    result: mutation.data,
    error: mutation.error,
    isPending: mutation.isPending,
    reset: mutation.reset,
  };
};
