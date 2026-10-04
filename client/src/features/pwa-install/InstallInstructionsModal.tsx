import { usePwaInstall } from "../../context/pwa-install";
import { INSTALL_GUIDES } from "../../data/installInstructions";
import { Modal } from "../../ui_comps/modal";
import type { InstallGuide } from "../../interfaces/pwa";
import {
  StyledGlyph,
  StyledGuide,
  StyledGuideHead,
  StyledHeading,
  StyledNote,
  StyledSteps,
} from "./styles";

interface InstallInstructionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const InstallGlyph = ({ icon }: { icon: InstallGuide["icon"] }) => {
  switch (icon) {
    case "share":
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 3v12M12 3 8 7M12 3l4 4"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M6 12H5a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5a2 2 0 0 0-2-2h-1"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
    case "menu":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="5" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="12" cy="19" r="2" />
        </svg>
      );
    case "dock":
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect
            x="3"
            y="14"
            width="18"
            height="6"
            rx="2"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M8 17h.01M12 17h.01M16 17h.01M12 4v7m0 0-3-3m3 3 3-3"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
          <path
            d="M3 12h18M12 3c2.5 2.7 3.8 6 3.8 9S14.5 21.3 12 21c-2.5.3-3.8-3-3.8-6S9.5 5.7 12 3Z"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
      );
  }
};

/** Platform-aware "here's how to install" dialog, shown when the browser can't
 *  raise a native install prompt (iOS/Safari, Firefox, in-app webviews …). */
export const InstallInstructionsModal = ({
  isOpen,
  onClose,
}: InstallInstructionsModalProps) => {
  const { platform } = usePwaInstall();
  const guide = INSTALL_GUIDES[platform];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Install TailgatePro" size="sm">
      <StyledGuide>
        <StyledGuideHead>
          <StyledGlyph>
            <InstallGlyph icon={guide.icon} />
          </StyledGlyph>
          <StyledHeading>{guide.heading}</StyledHeading>
        </StyledGuideHead>
        <StyledSteps>
          {guide.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </StyledSteps>
        {guide.note && <StyledNote>{guide.note}</StyledNote>}
      </StyledGuide>
    </Modal>
  );
};
