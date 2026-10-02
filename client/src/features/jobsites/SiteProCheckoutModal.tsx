import { GC_PLANS } from "../../data/plans";
import { useSiteCheckout } from "../../hooks/useSiteCheckout";
import { Button } from "../../ui_comps/button";
import { Modal } from "../../ui_comps/modal";
import { StyledNote, StyledSiteProActions } from "./styles";

const SITE_PRO_PRICE = GC_PLANS.find((plan) => plan.id === "gc-site-pro")!.price;

interface SiteProCheckoutModalProps {
  /** The jobsite to upgrade, or `null` when closed. */
  jobsite: { id: string; name: string } | null;
  onClose: () => void;
  /** Checkout is online-only. */
  isOnline: boolean;
}

/** Picks monthly or annual billing for one jobsite's GC Site Pro, then sends
 *  the browser to Stripe Checkout. The plan only changes when Stripe's webhook
 *  confirms payment; see `useSiteCheckoutReturn`. */
export const SiteProCheckoutModal = ({
  jobsite,
  onClose,
  isOnline,
}: SiteProCheckoutModalProps) => {
  const { startSiteCheckout, isStarting } = useSiteCheckout();

  if (!jobsite) return null;

  return (
    <Modal isOpen onClose={onClose} title="Upgrade to GC Site Pro" size="sm">
      <StyledNote>
        Unlock the OSHA Defense Bundle, PDF branding and every subcontractor's
        full compliance on {jobsite.name}. Billed per job site; manage or cancel
        anytime from Settings.
      </StyledNote>
      <StyledSiteProActions>
        <Button
          variant="primary"
          size="md"
          disabled={!isOnline || isStarting}
          loading={isStarting}
          onClick={() =>
            startSiteCheckout({ jobsiteId: jobsite.id, interval: "monthly" })
          }
        >
          {`${SITE_PRO_PRICE.monthly}/mo`}
        </Button>
        <Button
          variant="outline"
          size="md"
          disabled={!isOnline || isStarting}
          onClick={() =>
            startSiteCheckout({ jobsiteId: jobsite.id, interval: "annual" })
          }
        >
          {`${SITE_PRO_PRICE.annual}/yr (save 20%)`}
        </Button>
      </StyledSiteProActions>
    </Modal>
  );
};
