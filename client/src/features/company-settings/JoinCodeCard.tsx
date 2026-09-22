import toast from "react-hot-toast";

import { Button } from "../../ui_comps/button";
import { Spinner } from "../../ui_comps/spinner";
import {
  StyledJoinCode,
  StyledJoinCodeError,
  StyledJoinCodeRow,
  StyledSectionHelp,
} from "./styles";

interface JoinCodeCardProps {
  /** The GC's join code, or `null` while it loads or if it could not be loaded. */
  joinCode: string | null;
  isLoading: boolean;
  isError: boolean;
}

/**
 * The GC's join code, shown big enough to read aloud on a job site with a
 * Copy button. A subcontractor enters it on a project to link that project to
 * this GC. Presentational — the caller owns the query (`useJoinCode`).
 */
export const JoinCodeCard = ({
  joinCode,
  isLoading,
  isError,
}: JoinCodeCardProps) => {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(joinCode!);
      toast.success("Join code copied");
    } catch {
      // Clipboard access can be denied or unavailable (insecure context,
      // permissions), so point the user at the code that's on screen.
      toast.error("Could not copy. Select the code and copy it manually.");
    }
  };

  return (
    <>
      <StyledSectionHelp>
        Give this code to your subcontractors. They enter it on a project to
        link it to you.
      </StyledSectionHelp>

      {isLoading && <Spinner message="Loading your join code…" />}
      {isError && (
        <StyledJoinCodeError role="alert">
          Could not load your join code. Refresh to try again.
        </StyledJoinCodeError>
      )}
      {joinCode && (
        <StyledJoinCodeRow>
          <StyledJoinCode aria-label="Your join code">{joinCode}</StyledJoinCode>
          <Button type="button" size="md" onClick={handleCopy}>
            Copy code
          </Button>
        </StyledJoinCodeRow>
      )}
    </>
  );
};
