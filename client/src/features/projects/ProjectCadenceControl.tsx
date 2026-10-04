import { useSetMyCadence } from "../../hooks/useSetMyCadence";
import { Select } from "../../ui_comps/select";
import type {
  JobsiteMembership,
  MeetingCadence,
} from "../../interfaces/jobsite";
import {
  StyledCadenceLabel,
  StyledCadenceRow,
  StyledCadenceText,
  StyledMeta,
} from "./styles";

interface ProjectCadenceControlProps {
  membership: JobsiteMembership;
}

/** A subcontractor's own safety-talk cadence for the GC job site a project is
 *  linked to (Phase 11f). The GC sets the default; a sub can only tighten it
 *  (log daily on a weekly site), never relax it — so on a daily site there is
 *  nothing to choose and the control is fixed. */
export const ProjectCadenceControl = ({
  membership,
}: ProjectCadenceControlProps) => {
  const { setMyCadence, isSaving } = useSetMyCadence();
  const isWeeklySite = membership.jobsiteCadence === "weekly";

  const handleChange = (value: string) => {
    // "" = follow the GC's default (clears the override).
    setMyCadence({
      jobsiteId: membership.jobsiteId,
      cadence: value === "" ? null : (value as MeetingCadence),
    }).catch(() => {
      // useSetMyCadence already surfaces the failure as a toast.
    });
  };

  return (
    <StyledCadenceRow>
      <StyledCadenceText>
        <StyledCadenceLabel>Talk cadence</StyledCadenceLabel>
        <StyledMeta>
          {isWeeklySite
            ? "Your GC requires weekly — you can choose daily."
            : "Your GC requires daily."}
        </StyledMeta>
      </StyledCadenceText>
      <Select
        aria-label={`Talk cadence for ${membership.jobsiteName}`}
        value={membership.subCadence ?? ""}
        disabled={!isWeeklySite || isSaving}
        options={
          isWeeklySite
            ? [
                { value: "", label: "Weekly (GC default)" },
                { value: "daily", label: "Daily" },
              ]
            : [{ value: "", label: "Daily (GC default)" }]
        }
        onChange={(event) => handleChange(event.target.value)}
      />
    </StyledCadenceRow>
  );
};
