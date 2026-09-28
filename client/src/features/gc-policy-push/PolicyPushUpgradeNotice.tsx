import { Link } from "react-router-dom";

import { StyledUpgradeBanner, StyledUpgradeBody, StyledUpgradeTitle } from "./styles";

/** Shown in place of real data to a GC not on Portfolio. The nav link and
 *  page stay visible for every GC as a selling point (same convention as
 *  `gc-subcontractors` and the Defense Bundle button) -- only the data
 *  itself is withheld, and the server enforces the real gate regardless of
 *  what this renders. */
export const PolicyPushUpgradeNotice = () => (
  <StyledUpgradeBanner>
    <StyledUpgradeTitle>Top-down policy push is a GC Portfolio feature</StyledUpgradeTitle>
    <StyledUpgradeBody>
      Push a mandatory safety topic across every active job site at once, and see who's
      logged it. <Link to="/pricing">Upgrade to GC Portfolio</Link> to unlock it.
    </StyledUpgradeBody>
  </StyledUpgradeBanner>
);
