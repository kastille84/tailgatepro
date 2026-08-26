# Error Handling Standards

## Global Constraints

- NEVER use speculative or predictive error handling. Only handle anticipated, known failures.
- NEVER swallow errors with empty `catch` blocks or silent `try-catch` wrappers.
- DO NOT use absolute `ALWAYS/NEVER` instructions for edge cases; match existing file architecture.

## Pattern Conventions

- **Sync/Async Boundary:** Catch rejections locally or use a global boundary handler depending on the context.
- **Custom Exceptions:** Extend the base project error class (`AppError`) rather than throwing raw strings or native generic errors.
- **Context Preservation:** Always pass the original error string or object into the `cause` property of a wrapped error.

## Examples & Formatting

- Log errors at the boundary level with explicit contextual metadata (`userId`, `actionId`).
- Use standard validation frameworks for early exits instead of deep nested `try-catch` structures.
