import { Button } from "../../ui_comps/button";
import { useOnlineStatus } from "../../context/online-status";
import { useInHouseCrewActions, useInHouseCrews } from "../../hooks/useInHouseCrews";
import { StyledCrewActions, StyledNote } from "./styles";

interface AddInHouseCrewProps {
  jobsiteId: string;
  /** Company ids of the crews already on this job site's roster. */
  attachedCrewIds: string[];
}

/** Roster control: adds an in-house crew that is not on this job site yet (a
 *  crew only goes on the sites ticked when it was created, or later removed).
 *  Renders nothing when there is no crew left to add. */
export const AddInHouseCrew = ({ jobsiteId, attachedCrewIds }: AddInHouseCrewProps) => {
  const { isOnline } = useOnlineStatus();
  const { crews } = useInHouseCrews();
  const { attachCrew, isAttaching } = useInHouseCrewActions();

  const available = crews.filter((crew) => !crew.archivedAt && !attachedCrewIds.includes(crew.id));
  if (available.length === 0) return null;

  const handleAttach = async (crewId: string) => {
    try {
      await attachCrew({ jobsiteId, crewId });
    } catch {
      // useInHouseCrewActions already surfaces the failure as a toast.
    }
  };

  return (
    <>
      <StyledNote>Add one of your in-house crews to this job site.</StyledNote>
      <StyledCrewActions>
        {available.map((crew) => (
          <Button
            key={crew.id}
            type="button"
            variant="outline"
            size="md"
            loading={isAttaching}
            disabled={!isOnline}
            onClick={() => handleAttach(crew.id)}
          >
            Add {crew.name}
          </Button>
        ))}
      </StyledCrewActions>
    </>
  );
};
