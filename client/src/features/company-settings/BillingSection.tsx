import { Button } from "../../ui_comps/button";
import { Spinner } from "../../ui_comps/spinner";
import type { BillingSummary } from "../../interfaces/billing";
import {
  StyledBillingList,
  StyledBillingWarning,
  StyledJoinCodeError,
  StyledSectionHelp,
  StyledUpgradeLink,
} from "./styles";

interface BillingSectionProps {
  /** Display name of the caller's current plan, or `null` while it loads. */
  planName: string | null;
  /** The subscription summary, or `null` while it loads or if it failed. */
  billing: BillingSummary | null;
  isLoading: boolean;
  isError: boolean;
  /** True right after returning from Stripe, while the webhook catches up. */
  isConfirming: boolean;
  /** True while the Customer Portal link is being created. */
  isOpening: boolean;
  onManage: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  trialing: "Trial",
  past_due: "Payment past due",
  canceled: "Canceled",
  unpaid: "Unpaid",
  incomplete: "Incomplete",
  incomplete_expired: "Expired",
};

const INTERVAL_LABELS = { monthly: "Monthly", annual: "Annual" } as const;

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

/**
 * Settings → Billing: current plan, subscription status and renewal date, with
 * a "Manage billing" button that opens the Stripe Customer Portal (update card,
 * switch plan, cancel). A company that never subscribed is pointed at /pricing
 * instead. Presentational — the page owns the queries and the portal mutation.
 */
export const BillingSection = ({
  planName,
  billing,
  isLoading,
  isError,
  isConfirming,
  isOpening,
  onManage,
}: BillingSectionProps) => {
  const status = billing?.subscriptionStatus ?? null;

  return (
    <>
      <StyledSectionHelp>
        Your plan and payment details. Change plans, update your card or cancel
        from the billing portal.
      </StyledSectionHelp>

      {isConfirming && <Spinner message="Confirming your payment…" />}
      {isLoading && <Spinner message="Loading your billing details…" />}
      {isError && (
        <StyledJoinCodeError role="alert">
          Could not load your billing details. Refresh to try again.
        </StyledJoinCodeError>
      )}

      {billing && (
        <>
          <StyledBillingList>
            <dt>Plan</dt>
            <dd>{planName ?? "—"}</dd>
            {status && (
              <>
                <dt>Status</dt>
                <dd>{STATUS_LABELS[status] ?? status}</dd>
              </>
            )}
            {billing.billingInterval && (
              <>
                <dt>Billing</dt>
                <dd>{INTERVAL_LABELS[billing.billingInterval]}</dd>
              </>
            )}
            {status && billing.currentPeriodEnd && (
              <>
                <dt>{status === "canceled" ? "Ended" : "Next renewal"}</dt>
                <dd>{formatDate(billing.currentPeriodEnd)}</dd>
              </>
            )}
          </StyledBillingList>

          {status === "past_due" && (
            <StyledBillingWarning role="alert">
              Your last payment didn&apos;t go through. Update your payment
              method to keep your plan.
            </StyledBillingWarning>
          )}

          {billing.hasBillingAccount ? (
            <Button
              type="button"
              size="md"
              loading={isOpening}
              onClick={onManage}
            >
              Manage billing
            </Button>
          ) : (
            <StyledUpgradeLink to="/pricing">See plans and upgrade</StyledUpgradeLink>
          )}
        </>
      )}
    </>
  );
};
