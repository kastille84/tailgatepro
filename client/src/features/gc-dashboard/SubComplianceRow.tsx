import { dayOffReasonLabel } from "../../data/noWorkDayReasons";
import { InHouseBadge } from "../in-house-crews";
import type { GcSubCompliance } from "../../interfaces/gcDashboard";
import {
  StyledLockedRow,
  StyledLockedText,
  StyledSubMeta,
  StyledSubName,
  StyledSubRow,
  StyledStatusPill,
  StyledUnlockButton,
} from "./styles";

const STATUS_LABELS = { logged: "Logged", missing: "Missing", off: "Day off" } as const;

interface SubComplianceRowProps {
  sub: GcSubCompliance;
  onSelect: (sub: GcSubCompliance) => void;
  /** Opens the "Sub #2 blur" upsell for a plan-locked sub. */
  onUnlock: () => void;
}

/** One subcontractor's compliance status within a jobsite. The whole row is
 *  the drill-in click target, except a plan-locked sub: it renders a blurred
 *  placeholder (the server sends no real name or status for it) with an
 *  upgrade link and can't be opened. */
export const SubComplianceRow = ({
  sub,
  onSelect,
  onUnlock,
}: SubComplianceRowProps) => {
  if (sub.locked) {
    return (
      <li>
        <StyledLockedRow>
          <StyledLockedText aria-hidden="true">Subcontractor name</StyledLockedText>
          <StyledUnlockButton type="button" onClick={onUnlock}>
            Locked · Unlock on Site Pro
          </StyledUnlockButton>
        </StyledLockedRow>
      </li>
    );
  }

  const status = sub.status === "logged" || sub.status === "off" ? sub.status : "missing";

  return (
    <li>
      <StyledSubRow type="button" onClick={() => onSelect(sub)}>
        <StyledSubName>{sub.companyName ?? "Unknown company"}</StyledSubName>
        {sub.inHouse && <InHouseBadge />}
        <StyledSubMeta>
          {status === "off"
            ? `${dayOffReasonLabel(sub.reason) ?? "Day off"} · no talk required today`
            : sub.lastLoggedAt
              ? `Last logged ${new Date(sub.lastLoggedAt).toLocaleString()}`
              : `No talk logged ${sub.cadence === "weekly" ? "this week" : "today"}`}
        </StyledSubMeta>
        <StyledStatusPill $status={status}>{STATUS_LABELS[status]}</StyledStatusPill>
      </StyledSubRow>
    </li>
  );
};
