import type { GcSubCompliance } from "../../interfaces/gcDashboard";
import {
  StyledSubMeta,
  StyledSubName,
  StyledSubRow,
  StyledStatusPill,
} from "./styles";

interface SubComplianceRowProps {
  sub: GcSubCompliance;
  onSelect: (sub: GcSubCompliance) => void;
}

/** One subcontractor's compliance status within a jobsite. The whole row is
 *  the drill-in click target. */
export const SubComplianceRow = ({ sub, onSelect }: SubComplianceRowProps) => (
  <li>
    <StyledSubRow type="button" onClick={() => onSelect(sub)}>
      <StyledSubName>{sub.companyName ?? "Unknown company"}</StyledSubName>
      <StyledSubMeta>
        {sub.lastLoggedAt
          ? `Last logged ${new Date(sub.lastLoggedAt).toLocaleString()}`
          : "No talk logged today"}
      </StyledSubMeta>
      <StyledStatusPill $status={sub.status}>
        {sub.status === "logged" ? "Logged" : "Missing"}
      </StyledStatusPill>
    </StyledSubRow>
  </li>
);
