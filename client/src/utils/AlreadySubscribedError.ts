/**
 * Thrown when checkout is refused with a 409 `ALREADY_SUBSCRIBED`: the company
 * already has a live subscription, so the UI sends the user to Settings →
 * Billing to manage it instead of showing a generic error.
 */
export class AlreadySubscribedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AlreadySubscribedError";
  }
}
