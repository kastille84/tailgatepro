import { useState } from "react";
import { HiArrowDownTray } from "react-icons/hi2";

import { usePwaInstall } from "../../context/pwa-install";
import { INSTALL_BUTTON_LABEL } from "../../data/installInstructions";
import { Button } from "../../ui_comps/button";
import type { ButtonSize, ButtonVariant } from "../../ui_comps/button";
import { InstallInstructionsModal } from "./InstallInstructionsModal";

interface InstallButtonProps {
  size?: ButtonSize;
  variant?: ButtonVariant;
  className?: string;
}

/**
 * "Install app" button. On Chromium it fires the native install dialog; on
 * every other browser it opens step-by-step instructions. Renders nothing when
 * the app is already running installed.
 */
export const InstallButton = ({
  size = "sm",
  variant = "outline",
  className,
}: InstallButtonProps) => {
  const { isStandalone, canPrompt, promptInstall } = usePwaInstall();
  const [showInstructions, setShowInstructions] = useState(false);
  const [isPrompting, setIsPrompting] = useState(false);

  if (isStandalone) return null;

  const handleClick = async () => {
    if (!canPrompt) {
      setShowInstructions(true);
      return;
    }
    setIsPrompting(true);
    try {
      const outcome = await promptInstall();
      // The stashed event can vanish between render and click — fall back to
      // instructions rather than doing nothing.
      if (outcome === "unavailable") setShowInstructions(true);
    } finally {
      setIsPrompting(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        size={size}
        variant={variant}
        className={className}
        loading={isPrompting}
        leftIcon={<HiArrowDownTray aria-hidden="true" />}
        onClick={handleClick}
      >
        {INSTALL_BUTTON_LABEL}
      </Button>
      <InstallInstructionsModal
        isOpen={showInstructions}
        onClose={() => setShowInstructions(false)}
      />
    </>
  );
};
