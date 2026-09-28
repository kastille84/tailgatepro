import { Link } from "react-router-dom";

import { StyledUpgradeBanner, StyledUpgradeBody, StyledUpgradeTitle } from "./styles";

/** Shown in place of real data to a GC not on Portfolio. The nav link and
 *  page stay visible for every GC as a selling point (same convention as the
 *  Defense Bundle button and MeetingHistory's history-window banner) --
 *  only the data itself is withheld, and the server enforces the real gate
 *  regardless of what this renders. */
export const SubScorecardUpgradeNotice = () => (
  <StyledUpgradeBanner>
    <StyledUpgradeTitle>Cross-project scorecards are a GC Portfolio feature</StyledUpgradeTitle>
    <StyledUpgradeBody>
      See every subcontractor's safety compliance across your whole portfolio, rolled up
      into one score per sub. <Link to="/pricing">Upgrade to GC Portfolio</Link> to unlock
      it.
    </StyledUpgradeBody>
  </StyledUpgradeBanner>
);
