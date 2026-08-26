# React & TypeScript Coding Standards

### Component Conventions

- **Functional Components:** Always use functional components with arrow functions.
- **Typing Props:** Explicitly define component props using TypeScript `interface` rather than `type`.
- **Naming:** Use PascalCase for component files and folders (e.g., `UserProfile.tsx`). Use camelCase for hooks and utilities.
- **Exports:** Prefer named exports over default exports for safer refactoring and better IDE autocompletion.

### State & Performance

- **State Coherence:** Keep state as local as possible. Do not lift state up prematurely.
- **Derived State:** Compute values on the fly during render instead of storing derived state in `useState` or `useEffect`.
- **Hooks Array:** Always provide exhaustive dependency arrays for `useEffect`, `useMemo`, and `useCallback`.

### Data Fetching & Styling

- **Data Layer:** Use TanStack Query (React Query) for server state. Do not handle raw loading/error fetch flags inside components using standard `useEffect`.
- **Styling:** Use styled-components. Avoid inline styles and standard CSS files.

## Strict Boundaries & Anti-Patterns

- **No Console Logs:** Never leave `console.log()` or debugger statements in production-facing code.
- **Don't Default to Raw HTML Elements for UI:** Use the existing core primitives in `src/components/ui-comps/` instead of raw `<button>` or `<input>` elements to maintain layout continuity, only use raw HTML if no component satisfies your need.
- **No Secret Commits:** Never hardcode API keys, secrets, or environment variables. Use `.env.example` configurations.

# Node.js Express REST API

## Directory Map

src/
├── controllers/ # Request validation, parsing, and sending HTTP responses
├── middleware/ # Auth, error handling, validation, rate limiting
├── routes/ # Route definitions, route matching, and chaining middlewares
├── services/ # Pure business logic, framework-agnostic data mutations
└── utils/ # Shared helper functions, loggers, formatting utilities
server.js # Port binding and network listener, App initialization and middleware binding
.env # Environment variables, database connections, third-party initializations

## Architecture & Code Style Rules

### 1. Separation of Concerns (Layered Architecture)

- **Routes:** Only declare endpoints, HTTP methods, and wire up middleware. Never put business logic here.
- **Controllers:** Intercept `req` and `res`. Extract inputs (params, query, body), pass them to services, and send the HTTP response with appropriate status codes.
- **Services:** Pure business logic. Framework-agnostic. **NEVER** import Express-specific types or reference `req` or `res` inside a service.

### 2. Asynchronous Patterns

- **Always use `async/await`:** Never mix callback-style APIs with raw `.then().catch()` promise chains in the same module.
- **Callback wrapping:** If a third-party library relies on callbacks, wrap it using `util.promisify` before use.
- **Error Propagation:** Do not swallow errors. Let async exceptions ripple up to the global error handler.

### 3. Error Handling & Validation

- **Global Error Middleware:** Use a centralized error-handling middleware at the end of the `server.js` middleware stack.
- **Try/Catch Blocks:** Use `try/catch` in controllers. Pass errors directly to `next(error)` so the global boundary intercepts them.
- **Input Validation:** Use a library like `express-validator` inside route-level middleware to validate incoming headers, params, and body data before it strikes a controller.

### 4. Code Formatting & Syntax

- **Module System:** Use ES Modules (`import/export`) instead of CommonJS (`require`).
- **Naming Conventions:**
  - File names: camelCase (e.g., `userController.js`).
  - Variables and Functions: camelCase.
  - Classes and Schema Models: PascalCase.
  - Constants and Env variables: UPPER_SNAKE_CASE.
- **HTTP Responses:** Always respond with a structured JSON layout: `{ success: true, data: { ... } }` or `{ success: false, error: "Error message" }`.

### 5. Security & Best Practices

- **No Hardcoded Secrets:** Consume all keys via `process.env` utilizing a validated config module (e.g., `dotenv`).
- **Core Security Middleware:** Ensure `helmet`, `cors`, and `express.json()` are loaded globally.
- **Status Codes:** Express explicit status codes on responses (`200 OK`, `201 Created`, `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`, `500 Internal Server Error`).

### Example server/services/userService.js

```
import prisma from '../config/prismaClient.js';
import { hashPassword } from '../utils/cryptoUtils.js';
import stripeClient from '../config/stripe.js';

/**
 * Service handling all core business rules for Users.
 * Notice: No Express logic, no HTTP status codes, no req/res.
 */
export const userService = {

  /**
   * Registers a new user, hashes password, and provisions external accounts
   */
  async createUser(userData) {
    // 1. Business Logic: Check for duplicates
    const existingUser = await prisma.user.findUnique({ where: { email: userData.email } });
    if (existingUser) {
      throw new Error('Email is already registered'); // Let the controller map this to a 400 or 409
    }

    // 2. Data Mutation: Hash the password
    const hashedPassword = await hashPassword(userData.password);

    // 3. Third-Party Integration: Create a Stripe customer billing account
    const stripeCustomer = await stripeClient.customers.create({
      email: userData.email,
      name: `${userData.firstName} ${userData.lastName}`
    });

    // 4. DB Layer: Save the record
    const newUser = await prisma.user.create({
      data: {
        email: userData.email,
        passwordHash: hashedPassword,
        stripeCustomerId: stripeCustomer.id,
        role: 'customer'
      }
    });

    // 5. Return raw data or formatted data transfer objects (DTO)
    const { passwordHash, ...userWithoutPassword } = newUser;
    return userWithoutPassword;
  },

  /**
   * Fetches a user profile and filters internal fields
   */
  async getUserProfile(userId) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found'); // Let the controller map this to a 404
    }

    return user;
  }
};

```

### Example server/controller/userController.js

```
// server/controllers/userController.js
import { userService } from '../services/userService.js';

export const registerUser = async (req, res, next) => {
  try {
    // The controller only handles HTTP concerns (req.body, status codes, JSON responses)
    const userDto = await userService.createUser(req.body);

    return res.status(201).json({
      success: true,
      data: userDto
    });
  } catch (error) {
    // If the service throws "Email is already registered", this sends it to the global error handler
    next(error);
  }
};

```
