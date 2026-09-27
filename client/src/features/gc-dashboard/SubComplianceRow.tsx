import type { GcSubCompliance } from "../../interfaces/gcDashboard";
import {
  StyledLockedRow,
  StyledLockedText,
  StyledSubMeta,
  StyledSubName,
  StyledSubRow,
  StyledStatusPill,
  StyledUnlockLink,
} from "./styles";

interface SubComplianceRowProps {
  sub: GcSubCompliance;
  onSelect: (sub: GcSubCompliance) => void;
}

/** One subcontractor's compliance status within a jobsite. The whole row is
 *  the drill-in click target, except a plan-locked sub: it renders a blurred
 *  placeholder (the server sends no real name or status for it) with an
 *  upgrade link and can't be opened. */
export const SubComplianceRow = ({ sub, onSelect }: SubComplianceRowProps) => {
  if (sub.locked) {
    return (
      <li>
        <StyledLockedRow>
          <StyledLockedText aria-hidden="true">Subcontractor name</StyledLockedText>
          <StyledUnlockLink to="/pricing">Locked · Unlock on Site Pro</StyledUnlockLink>
        </StyledLockedRow>
      </li>
    );
  }

  return (
    <li>
      <StyledSubRow type="button" onClick={() => onSelect(sub)}>
        <StyledSubName>{sub.companyName ?? "Unknown company"}</StyledSubName>
        <StyledSubMeta>
          {sub.lastLoggedAt
            ? `Last logged ${new Date(sub.lastLoggedAt).toLocaleString()}`
            : "No talk logged today"}
        </StyledSubMeta>
        <StyledStatusPill $status={sub.status === "logged" ? "logged" : "missing"}>
          {sub.status === "logged" ? "Logged" : "Missing"}
        </StyledStatusPill>
      </StyledSubRow>
    </li>
  );
};
