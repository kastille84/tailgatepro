# Vitest Testing Standards

## Commands

- **Run All Tests:** `npm run test` or `npx vitest run`
- **Watch Mode:** `npx vitest`
- **Run Specific File:** `npx vitest path/to/file.test.js`
- **Filter by Name:** `npx vitest -t "should validate password"`
- **Coverage Report:** `npx vitest run --coverage`
- **UI Dashboard:** `npx vitest --ui`

## Test File Organization

- **Placement:** Place test files directly alongside the source file using the `.test.js` or `.spec.js` extension (e.g., `userService.js` and `userService.test.js`). For complex integrations, use a top-level `/tests` directory.
- **Naming Pattern:** `[fileName].test.[js|ts]`

## Structure & Syntax Rules

### 1. Test Block Organization (AAA Pattern)

- Follow the **Arrange-Act-Assert** pattern explicitly within tests. Use blank lines to visually isolate these phases.
- Group related tests inside structural `describe` blocks named after the module or method under test.
- Use descriptive `it` or `test` blocks starting with active verbs (e.g., `it('should return a user object when dynamic ID is valid', ...)`.

```javascript
describe("userService.createUser", () => {
  it("should hash password and save user successfully", async () => {
    // Arrange
    const rawData = {
      email: "test@example.com",
      password: "securePassword123",
    };

    // Act
    const result = await userService.createUser(rawData);

    // Assert
    expect(result).toHaveProperty("id");
    expect(result.email).toBe(rawData.email);
  });
});
```

### 2. Mocking Guidelines

- **Native Vitest Mocking:** Always use `vi.fn()`, `vi.spyOn()`, and `vi.mock()` instead of external mocking packages.
- **Module Mocks:** Place `vi.mock('module-name')` calls at the top level of the file, outside lifecycle blocks.
- **Resetting State:** Always clear mock history between individual tests to avoid cross-contamination. Use `vi.clearAllMocks()` or configure `clearMocks: true` in `vitest.config.js`.

### 3. Lifecycle Hooks

- **Setup/Teardown:** Use `beforeEach` and `afterEach` to reset shared database states, clean environment variables, or restore global mocks (`vi.restoreAllMocks()`).
- Avoid deeply nested lifecycle conditions that reduce readability.

### 4. Preferred Assertions

- Use strict equality (`toBe()`) for primitives.
- Use structural equality (`toEqual()`) for comparing array items and objects.
- Use explicit boolean assertions (`toBeTrue()`, `toBeFalse()`) instead of implicit truthy check evaluations.
- Use `.rejects.toThrow()` or `.rejects.toThrowError()` explicitly for testing thrown promises or async failure states.

### 5. Floating / Async Promises

- **Always await** asynchronous operations, mock resolutions, or events inside code blocks to eliminate test flakiness or unhandled promise rejection warnings.
