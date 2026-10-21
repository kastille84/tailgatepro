import type { GcOverviewTotals } from "../../interfaces/gcDashboard";
import { StyledStatRow, StyledStatTile } from "./styles";

interface StatTilesProps {
  totals: GcOverviewTotals;
}

/** The headline numbers for the GC's overview: subs on site, how many
 *  have logged for their current period (today, or this week for a weekly
 *  cadence), how many are missing, and (only when any) how many have the day off. Purely presentational. */
export const StatTiles = ({ totals }: StatTilesProps) => (
  <StyledStatRow $columns={totals.off > 0 ? 4 : 3}>
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
    {totals.off > 0 && (
      <StyledStatTile>
        <strong>{totals.off}</strong>
        <span>day off</span>
      </StyledStatTile>
    )}
  </StyledStatRow>
);
