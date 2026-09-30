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
}

/** Conversion-trigger upsell (strategy doc §6): the trigger's copy plus a
 *  link to /pricing and a "Not now" dismiss. Purely informational — no billing. */
export const UpgradeModal = ({ trigger, params, onClose }: UpgradeModalProps) => {
  if (!trigger) return null;
  const copy = getUpgradeCopy(trigger, params);
  return (
    <Modal isOpen onClose={onClose} title={copy.title} size="sm">
      <StyledUpgradeBody>{copy.body}</StyledUpgradeBody>
      <StyledUpgradeActions>
        <Button type="button" variant="outline" size="md" onClick={onClose}>
          Not now
        </Button>
        <StyledUpgradeCta to="/pricing" onClick={onClose}>
          {copy.cta}
        </StyledUpgradeCta>
      </StyledUpgradeActions>
    </Modal>
  );
};
