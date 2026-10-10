const keyFor = (companyId: string) => `tailgatepro.inHouseCrewsPrompt.${companyId}`;

/** Whether this company's GC has dismissed the in-house crews onboarding card
 *  ("Not now"). Per company, in localStorage; every access is guarded because
 *  storage can throw or be unavailable (private windows, blocked site data) —
 *  the card then just shows again, which is harmless. */
export const isInHouseOnboardingDismissed = (companyId: string): boolean => {
  try {
    return localStorage.getItem(keyFor(companyId)) === "dismissed";
  } catch {
    return false;
  }
};

export const dismissInHouseOnboarding = (companyId: string): void => {
  try {
    localStorage.setItem(keyFor(companyId), "dismissed");
  } catch {
    // Storage unavailable: the card shows again next visit.
  }
};
