/**
 * Thrown when the server rejects an action with a 403 `PLAN_LIMIT` (seat cap,
 * history window). Lets callers show an inline upgrade prompt instead of a
 * plain error toast.
 */
export class PlanLimitError extends Error {
  limit: number | null;

  constructor(message: string, limit: number | null = null) {
    super(message);
    this.name = "PlanLimitError";
    this.limit = limit;
  }
}
