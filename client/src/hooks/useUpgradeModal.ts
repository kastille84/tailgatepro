import { useCallback, useState } from "react";

import type {
  UpgradeParams,
  UpgradeTrigger,
} from "../constants/upgradeTriggers";

interface UpgradeModalState {
  trigger: UpgradeTrigger;
  params?: UpgradeParams;
}

/** Open/close state for the conversion-trigger `UpgradeModal`. Render
 *  `<UpgradeModal trigger={trigger} params={params} onClose={close} />`. */
export const useUpgradeModal = () => {
  const [state, setState] = useState<UpgradeModalState | null>(null);

  const open = useCallback(
    (trigger: UpgradeTrigger, params?: UpgradeParams) =>
      setState({ trigger, params }),
    [],
  );
  const close = useCallback(() => setState(null), []);

  return {
    trigger: state?.trigger ?? null,
    params: state?.params,
    open,
    close,
  };
};
