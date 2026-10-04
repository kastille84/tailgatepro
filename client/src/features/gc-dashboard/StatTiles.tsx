import type { GcOverviewTotals } from "../../interfaces/gcDashboard";
import { StyledStatRow, StyledStatTile } from "./styles";

interface StatTilesProps {
  totals: GcOverviewTotals;
}

/** The three headline numbers for the GC's overview: subs on site, how many
 *  have logged for their current period (today, or this week for a weekly
 *  cadence), how many are missing. Purely presentational. */
export const StatTiles = ({ totals }: StatTilesProps) => (
  <StyledStatRow>
    <StyledStatTile>
      <strong>{totals.subs}</strong>
      <span>subs on site</span>
    </StyledStatTile>
    <StyledStatTile>
      <strong>{totals.logged}</strong>
      <span>logged</span>
    </StyledStatTile>
    <StyledStatTile>
      <strong>{totals.missing}</strong>
      <span>missing</span>
    </StyledStatTile>
  </StyledStatRow>
);
