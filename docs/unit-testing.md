# Vitest Testing Standards

This standard applies to both `client/` and the root-level `server/` code (confirmed with the maintainer — previously ambiguous, since root `devDependencies` also list unused `mocha`/`chai`/`sinon`). The two run under separate configs: `client/vite.config.ts` (browser-ish/jsdom, 90% coverage gate) for `client/tests/**`, and root `vitest.config.js` (plain Node) for `server/**/*.test.js`.

**Server tests must be plain CommonJS** — `require()`/`module.exports`, no `import`/`export` statements (Vitest's globals, enabled via `globals: true` in the root config, provide `describe`/`it`/`expect`/`vi`/etc. without needing to import them). This isn't a style preference: a server test file written with `import` loads its CJS modules-under-test through a different module-resolution path than a plain `require()`-based test file does, and the two can end up with two separate instances of the same module — silently breaking any `vi.mock()`/spy on it, since the code under test then reads from a different, unmocked instance. See `server/middlewares/requireAuth.test.js` for a worked example, including the further wrinkle that a value destructured at require-time (e.g. `const { v4 } = require("uuid")`) can't be redirected by mutating the module later — only a property accessed fresh at call time (e.g. `supabase.from(...)`) can be reliably spied on after the fact.

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

## Testing React Components with Context Providers

TailgatePro components frequently depend on multiple context providers. When testing such components, you must wrap them with all required providers. This section documents the common provider dependencies and how to set them up.

### Required Providers

#### 1. **ThemeProvider** (styled-components)

All components using styled-components require theme context. Use the theme from `client/src/styles/theme.ts`.

```typescript
import { ThemeProvider } from "styled-components";
import theme from "../path/to/styles/theme";

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>{component}</ThemeProvider>
  );
};
```

#### 2. **QueryClientProvider** (React Query)

Components that use hooks like `useWaitlist()` or any TanStack Query mutations/queries require a `QueryClient`. Always create a fresh client per test to avoid cross-contamination.

```typescript
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const renderWithQueryClient = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  );
};
```

#### 3. **Combined Provider Wrapper** (Most Common)

Most page components require both theme and query context. Combine them into a single test helper:

```typescript
describe("MyComponent", () => {
  const renderWithProviders = (component: React.ReactElement) => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    return render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>{component}</ThemeProvider>
      </QueryClientProvider>
    );
  };

  it("should render correctly", () => {
    renderWithProviders(<MyComponent />);
    // assertions...
  });
});
```

### Mocking Global Styles

The `GlobalStyles` component from `client/src/styles/GlobalStyles.ts` can cause issues in tests. Mock it at the top of your test file:

```typescript
vi.mock("../path/to/styles/GlobalStyles", () => ({
  GlobalStyles: () => null,
}));
```

## Assertion Alternatives

**Note:** `@testing-library/jest-dom` is not installed in this project. Use these alternatives for common assertions:

| Common Pattern                                     | Vitest Alternative                                   | Notes                                      |
| -------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------ |
| `expect(element).toBeInTheDocument()`              | `expect(() => screen.getByText(...)).not.toThrow()`  | getBy\* queries throw if element not found |
| `expect(element).toBeVisible()`                    | `expect(() => screen.getByText(...)).not.toThrow()`  | Same as above; verifies renderability      |
| `expect(element).toHaveAttribute('attr', 'value')` | `expect(element.getAttribute('attr')).toBe('value')` | Direct DOM API call                        |
| `expect(element).toHaveClass('className')`         | `expect(element.className).toContain('className')`   | Access className property directly         |

### Why These Patterns Work

- **`.not.toThrow()`** — React Testing Library's `getBy*` queries throw an error if the element isn't found, so wrapping them in `expect(() => ...).not.toThrow()` verifies both presence and accessibility.
- **`.toBeDefined()`** — Directly asserts that a queried element exists and is truthy.
- **`.getAttribute()`** — Direct DOM API for checking attributes; equivalent to jest-dom's `toHaveAttribute()`.
- **`.className.toContain()`** — Direct property access for class assertions.

## Common Testing Pitfalls & Solutions

### 1. **"No QueryClient set" Error**

**Problem:** Component uses a hook like `useWaitlist()` or any React Query hook but isn't wrapped with `QueryClientProvider`.

**Solution:** Wrap component with `QueryClientProvider` and a fresh `QueryClient` instance in each test:

```typescript
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
});
render(
  <QueryClientProvider client={queryClient}>
    <YourComponent />
  </QueryClientProvider>
);
```

### 2. **"Cannot read properties of undefined (reading 'navy')" Error**

**Problem:** Styled-components can't access theme values because `ThemeProvider` is missing. Occurs when any styled component tries to access `props.theme.*`.

**Solution:** Wrap component with `<ThemeProvider theme={theme}>` from `client/src/styles/theme.ts`. Remember to import the theme object first.

### 3. **Test File Import Path Issues**

**Problem:** Import paths to theme/styles are incorrect, causing "Cannot find module" errors.

**Solution:** Use relative paths correctly from the test file location:

- If test is in `client/tests/pages/Landing/Landing.test.tsx`
- And theme is in `client/src/styles/theme.ts`
- Use path: `../../../src/styles/theme`

Count the directory levels: `tests/` → `pages/` → `Landing/` (3 up) → `src/` → `styles/` (2 down)

### 4. **Missing React Import with JSX**

**Problem:** Test fails with "React is not defined" error even though code contains JSX.

**Solution:** Import React at the top of the test file, even though modern React doesn't strictly require it:

```typescript
import React from "react";
```

### 5. **GlobalStyles Component Rendering Issues**

**Problem:** `GlobalStyles` throws errors or causes issues during test execution because it's a `createGlobalStyle()` component.

**Solution:** Mock it at the top level of your test file, before any renders:

```typescript
vi.mock("../../../src/styles/GlobalStyles", () => ({
  GlobalStyles: () => null,
}));
```

## Example: Complete Page Component Test

Here's a complete, production-ready pattern for testing a page component with multiple dependencies (theme + query context):

```typescript
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MyPageComponent } from "../../../src/pages/MyPage";
import theme from "../../../src/styles/theme";

// Mock GlobalStyles at the top level
vi.mock("../../../src/styles/GlobalStyles", () => ({
  GlobalStyles: () => null,
}));

describe("MyPageComponent", () => {
  // Create a reusable provider wrapper for all tests
  const renderWithProviders = (component: React.ReactElement) => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    return render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>{component}</ThemeProvider>
      </QueryClientProvider>
    );
  };

  it("should render the main heading", () => {
    // Arrange & Act
    renderWithProviders(<MyPageComponent />);

    // Assert - use .not.toThrow() pattern for element presence
    expect(() =>
      screen.getByRole("heading", { name: /expected heading/i })
    ).not.toThrow();
  });

  it("should render with correct attributes", () => {
    // Arrange & Act
    renderWithProviders(<MyPageComponent />);

    // Assert - use .getAttribute() instead of .toHaveAttribute()
    const element = screen.getByTestId("my-element");
    expect(element.getAttribute("data-value")).toBe("expected");
  });

  it("should render text content correctly", () => {
    // Arrange & Act
    renderWithProviders(<MyPageComponent />);

    // Assert - getByText verifies presence and accessibility
    expect(() => screen.getByText(/some text/i)).not.toThrow();
  });
});
```

## Test Setup Checklist for Page Components

When creating tests for page-level components:

- [ ] Import `React` (even though React 19 doesn't require it for JSX)
- [ ] Import theme from `client/src/styles/theme.ts`
- [ ] Create `QueryClient` with `{ retry: false }` defaults
- [ ] Wrap component with `QueryClientProvider` → `ThemeProvider`
- [ ] Mock `GlobalStyles` at the top of the test file
- [ ] Use `getBy*` queries; they throw if elements don't exist
- [ ] Verify presence with `.not.toThrow()` or `.toBeDefined()`
- [ ] Verify attributes with `.getAttribute()`
- [ ] Create a fresh `QueryClient` for each test to prevent state leakage
