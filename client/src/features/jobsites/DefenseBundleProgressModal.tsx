import { Modal } from "../../ui_comps/modal";
import { Spinner } from "../../ui_comps/spinner";

interface DefenseBundleProgressModalProps {
  isOpen: boolean;
}

/** Shown for the duration of useDownloadDefenseBundle's mutation. Assembling
 *  the ZIP can take a while for a site with a lot of history — the server
 *  downloads and compresses one PDF per completed log in sequence
 *  (docs/osha-defense-bundle-design.md) — so this tells the GC the click
 *  worked instead of leaving only the button's own small spinner as feedback.
 *  Non-dismissable: there's no cancel wiring, closing early wouldn't stop the
 *  in-flight download, and it closes itself once the mutation settles
 *  (isOpen tracks isPending, success or error). Progress is intentionally
 *  indeterminate, not a percentage — the server never knows the final
 *  compressed size ahead of time (no Content-Length is set), so a real
 *  progress bar isn't possible without re-architecting the transport
 *  (docs/osha-defense-bundle-design.md). */
export const DefenseBundleProgressModal = ({ isOpen }: DefenseBundleProgressModalProps) => (
  <Modal
    isOpen={isOpen}
    // Modal's `onClose` is required, but with `dismissable={false}` it never
    // actually calls it (Esc/overlay-click/close-button are all no-ops) — so
    // this can't be exercised by a test. Satisfies the prop type only.
    /* v8 ignore next */
    onClose={() => {}}
    dismissable={false}
    title="Preparing your Defense Bundle"
  >
    <Spinner
      center
      message="Zipping up this site's meeting logs and PDFs — this can take a minute or two for sites with a lot of history. Please don't close this tab."
    />
  </Modal>
);
