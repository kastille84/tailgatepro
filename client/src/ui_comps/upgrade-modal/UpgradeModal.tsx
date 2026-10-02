import {
  getUpgradeCopy,
  type UpgradeParams,
  type UpgradeTrigger,
} from "../../constants/upgradeTriggers";
import { Button } from "../button";
import { Modal } from "../modal";
import {
  StyledUpgradeActions,
  StyledUpgradeBody,
  StyledUpgradeCta,
} from "./styles";

export interface UpgradeModalProps {
  /** The open trigger, or `null` when closed. */
  trigger: UpgradeTrigger | null;
  params?: UpgradeParams;
  onClose: () => void;
  /** When given, the CTA is a button that starts an in-app purchase instead of
   *  a link to /pricing (used where the purchase target is known, e.g. a
   *  specific jobsite's Site Pro). */
  onUpgrade?: () => void;
}

/** Conversion-trigger upsell (strategy doc §6): the trigger's copy plus a
 *  link to /pricing (or an `onUpgrade` action) and a "Not now" dismiss. */
export const UpgradeModal = ({
  trigger,
  params,
  onClose,
  onUpgrade,
}: UpgradeModalProps) => {
  if (!trigger) return null;
  const copy = getUpgradeCopy(trigger, params);
  return (
    <Modal isOpen onClose={onClose} title={copy.title} size="sm">
      <StyledUpgradeBody>{copy.body}</StyledUpgradeBody>
      <StyledUpgradeActions>
        <Button type="button" variant="outline" size="md" onClick={onClose}>
          Not now
        </Button>
        {onUpgrade ? (
          <Button type="button" variant="primary" size="md" onClick={onUpgrade}>
            {copy.cta}
          </Button>
        ) : (
          <StyledUpgradeCta to="/pricing" onClick={onClose}>
            {copy.cta}
          </StyledUpgradeCta>
        )}
      </StyledUpgradeActions>
    </Modal>
  );
};
