import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";

import { CHECKOUT_PLANS } from "../../data/checkoutPlans";
import { useCheckout } from "../../hooks/useCheckout";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { Button } from "../../ui_comps/button";
import { Footer } from "../../ui_comps/footer";
import { AlreadySubscribedError } from "../../utils/AlreadySubscribedError";
import {
  clearPendingCheckout,
  parsePendingCheckout,
} from "../../utils/pendingCheckout";
import {
  StyledActions,
  StyledBackLink,
  StyledCard,
  StyledError,
  StyledHeading,
  StyledMain,
  StyledPage,
  StyledText,
} from "./Checkout.styles";

/** `/checkout?plan=&interval=` — starts a hosted Stripe Checkout for the plan
 *  picked on /pricing, then sends the browser to Stripe. Sits behind
 *  `RequireAuth`, so a visitor who isn't signed in is bounced to /login (or
 *  /signup first) and lands back here. Everything shown before the redirect is
 *  a UI hint; the server re-checks role and company type on the request. */
export const Checkout = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { companyType, isManagerRole, isLoading } = useCurrentUser();
  const { startCheckout, isStarting, error } = useCheckout();
  const started = useRef(false);

  const pending = parsePendingCheckout(searchParams);
  const plan = pending ? CHECKOUT_PLANS[pending.plan] : null;
  const planMatches = !!plan && plan.companyType === companyType;
  const canStart = !!pending && !isLoading && isManagerRole && planMatches;

  // The plan choice has been acted on (or abandoned); don't replay it on a
  // later login.
  useEffect(() => {
    clearPendingCheckout();
  }, []);

  // Fire once: a re-render or a Strict Mode double effect must not open two
  // checkout sessions.
  useEffect(() => {
    if (canStart && !started.current) {
      started.current = true;
      startCheckout(pending);
    }
  }, [canStart, pending, startCheckout]);

  // Already subscribed: send them to manage the plan instead of paying twice.
  const alreadySubscribed = error instanceof AlreadySubscribedError;
  useEffect(() => {
    if (alreadySubscribed) {
      toast("You already have a subscription. Use Manage billing to change it.");
      navigate("/settings", { replace: true });
    }
  }, [alreadySubscribed, navigate]);

  const renderBody = () => {
    if (!pending || !plan) {
      return (
        <>
          <StyledHeading>That plan link isn&apos;t valid</StyledHeading>
          <StyledText>Pick a plan from our pricing page to continue.</StyledText>
          <StyledBackLink to="/pricing">See pricing</StyledBackLink>
        </>
      );
    }

    if (isLoading) {
      return <StyledText role="status">Loading your account…</StyledText>;
    }

    if (!isManagerRole) {
      return (
        <>
          <StyledHeading>Ask your admin to upgrade</StyledHeading>
          <StyledText>
            Only a company admin or safety director can start a subscription.
          </StyledText>
          <StyledBackLink to="/dashboard">Back to dashboard</StyledBackLink>
        </>
      );
    }

    if (!planMatches) {
      return (
        <>
          <StyledHeading>That plan isn&apos;t for your account</StyledHeading>
          <StyledText>
            {plan.name} is not available for{" "}
            {companyType === "gc" ? "general contractor" : "subcontractor"}{" "}
            accounts.
          </StyledText>
          <StyledBackLink to="/pricing">See pricing</StyledBackLink>
        </>
      );
    }

    if (error && !alreadySubscribed) {
      return (
        <>
          <StyledHeading>We couldn&apos;t start checkout</StyledHeading>
          <StyledError role="alert">{error.message}</StyledError>
          <StyledActions>
            <Button
              type="button"
              variant="primary"
              size="lg"
              loading={isStarting}
              onClick={() => startCheckout(pending)}
            >
              Try again
            </Button>
            <StyledBackLink to="/pricing">Back to pricing</StyledBackLink>
          </StyledActions>
        </>
      );
    }

    return (
      <>
        <StyledHeading>Taking you to secure checkout</StyledHeading>
        <StyledText role="status" aria-live="polite">
          Setting up {plan.name}… you&apos;ll be on Stripe in a moment.
        </StyledText>
      </>
    );
  };

  return (
    <StyledPage>
      <StyledMain>
        <StyledCard>{renderBody()}</StyledCard>
      </StyledMain>
      <Footer />
    </StyledPage>
  );
};
