import { useState } from "react";

import { Button } from "../../ui_comps/button";
import {
  dismissInHouseOnboarding,
  isInHouseOnboardingDismissed,
} from "../../utils/inHouseOnboarding";
import { StyledCard, StyledCardActions, StyledCardTitle, StyledNote } from "./styles";

interface InHouseOnboardingCardProps {
  companyId: string;
  /** Opens the crew form. */
  onAddCrews: () => void;
}

/** One-time prompt on the GC dashboard for a GC that has no in-house crews
 *  yet. "Not now" is remembered per company in localStorage. The parent
 *  decides *whether* the GC has crews; this only owns the dismissal. */
export const InHouseOnboardingCard = ({ companyId, onAddCrews }: InHouseOnboardingCardProps) => {
  const [dismissed, setDismissed] = useState(() => isInHouseOnboardingDismissed(companyId));

  if (dismissed) return null;

  const handleDismiss = () => {
    dismissInHouseOnboarding(companyId);
    setDismissed(true);
  };

  return (
    <StyledCard aria-labelledby="in-house-onboarding-title">
      <StyledCardTitle id="in-house-onboarding-title">
        Does your company have its own crews?
      </StyledCardTitle>
      <StyledNote>
        If your own employees do trade work like framing or roofing, add each crew here and
        choose which job sites it works on. Their safety talks show up on your dashboard with an
        In-house badge, and they don't use up your free subcontractor slots. You can invite each
        crew's foremen by email.
      </StyledNote>
      <StyledCardActions>
        <Button type="button" variant="primary" size="md" onClick={onAddCrews}>
          Yes, add my crews
        </Button>
        <Button type="button" variant="outline" size="md" onClick={handleDismiss}>
          Not now
        </Button>
      </StyledCardActions>
      <StyledNote>You can add or manage crews anytime in Settings → In-house crews.</StyledNote>
    </StyledCard>
  );
};
