import { Modal } from "../modal";
import { Spinner } from "../spinner";

export interface ProgressModalProps {
  isOpen: boolean;
  /** The dialog's title (e.g. "Preparing your Defense Bundle"). */
  title: string;
  /** Caption under the spinner explaining what's happening and why it takes a
   *  moment. */
  message: string;
}

/** A non-dismissable "this is working, it can take a moment" overlay for a
 *  long-running action with no meaningful percentage to report (e.g. building
 *  a Defense Bundle ZIP server-side — see docs/osha-defense-bundle-design.md
 *  and docs/sub-defense-bundle-design.md for why that's indeterminate, not a
 *  progress bar). Built on the `Modal` + `Spinner` primitives rather than a
 *  bespoke overlay so it gets the same focus trap, scroll lock and dialog
 *  semantics every other modal in the app has. There's no cancel wiring, and
 *  closing early wouldn't stop the underlying work anyway, so it closes
 *  itself once the caller's `isOpen` (typically a mutation's `isPending`)
 *  goes false, whether that's a success or an error. */
export const ProgressModal = ({ isOpen, title, message }: ProgressModalProps) => (
  <Modal
    isOpen={isOpen}
    // Modal's `onClose` is required, but with `dismissable={false}` it never
    // actually calls it (Esc/overlay-click/close-button are all no-ops) — so
    // this can't be exercised by a test. Satisfies the prop type only.
    /* v8 ignore next */
    onClose={() => {}}
    dismissable={false}
    title={title}
  >
    <Spinner center message={message} />
  </Modal>
);
