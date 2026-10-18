import { StyledTermsNotice } from "./styles";

/**
 * "By continuing you agree..." line for account-creating flows that have no
 * room for the full consent checkbox (Google sign-in, invite and join pages).
 * Sits on the dark hero, like the form it accompanies.
 */
export const TermsNotice = () => (
  <StyledTermsNotice>
    By continuing, you agree to our{" "}
    <a href="/terms">Terms &amp; Conditions</a> and{" "}
    <a href="/privacy">Privacy Policy</a>.
  </StyledTermsNotice>
);
