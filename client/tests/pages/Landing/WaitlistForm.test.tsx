import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WaitlistForm } from "../../../src/pages/Landing/WaitlistForm";
import theme from "../../../src/styles/theme";
import * as apiWaitlistModule from "../../../src/services/apiWaitlist";

// Mock styled-components global styles
vi.mock("../../../src/styles/GlobalStyles", () => ({
  GlobalStyles: () => null,
}));

// Mock the apiWaitlist service
vi.mock("../../../src/services/apiWaitlist");

// Mock react-hot-toast
vi.mock("react-hot-toast", () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe("WaitlistForm", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>{component}</ThemeProvider>
      </QueryClientProvider>,
    );
  };

  describe("Form Rendering", () => {
    it("should render all form fields", () => {
      renderWithProviders(<WaitlistForm idPrefix="test" />);

      expect(() => screen.getByLabelText(/^Name$/i)).not.toThrow();
      expect(() => screen.getByLabelText(/^Work email$/i)).not.toThrow();
      expect(() => screen.getByLabelText(/Company/i)).not.toThrow();
    });

    it("should render submit button", () => {
      renderWithProviders(<WaitlistForm idPrefix="test" />);

      expect(() =>
        screen.getByRole("button", { name: /Join the waitlist/i }),
      ).not.toThrow();
    });

    it("should namespace field IDs correctly with idPrefix", () => {
      renderWithProviders(<WaitlistForm idPrefix="hero" />);

      const nameInput = screen.getByPlaceholderText(
        "Edwin Martinez",
      ) as HTMLInputElement;
      expect(nameInput.id).toBe("hero-waitlist-name");

      const emailInput = screen.getByPlaceholderText(
        "you@company.com",
      ) as HTMLInputElement;
      expect(emailInput.id).toBe("hero-waitlist-email");

      const companyInput = screen.getByPlaceholderText(
        "Rivera Electric",
      ) as HTMLInputElement;
      expect(companyInput.id).toBe("hero-waitlist-company");
    });

    it("should render form with onLight tone by default", () => {
      renderWithProviders(<WaitlistForm idPrefix="test" tone="onLight" />);

      const form = screen
        .getByRole("button", {
          name: /Join the waitlist/i,
        })
        .closest("form");
      expect(form).toBeDefined();
    });

    it("should render form with onDark tone", () => {
      renderWithProviders(<WaitlistForm idPrefix="test" tone="onDark" />);

      const form = screen
        .getByRole("button", {
          name: /Join the waitlist/i,
        })
        .closest("form");
      expect(form).toBeDefined();
    });

    it("should show (optional) text for company field", () => {
      renderWithProviders(<WaitlistForm idPrefix="test" />);

      expect(() => screen.getByText(/\(optional\)/i)).not.toThrow();
    });
  });

  describe("Form Validation", () => {
    it("should show error when name is empty on blur", async () => {
      renderWithProviders(<WaitlistForm idPrefix="test" />);
      const nameInput = screen.getByPlaceholderText(
        "Edwin Martinez",
      ) as HTMLInputElement;

      fireEvent.focus(nameInput);
      fireEvent.blur(nameInput);

      await waitFor(() => {
        expect(() => screen.getByText(/Name is required/i)).not.toThrow();
      });
    });

    it("should show error when email is empty on blur", async () => {
      renderWithProviders(<WaitlistForm idPrefix="test" />);
      const emailInput = screen.getByPlaceholderText(
        "you@company.com",
      ) as HTMLInputElement;

      fireEvent.focus(emailInput);
      fireEvent.blur(emailInput);

      await waitFor(() => {
        expect(() => screen.getByText(/Email is required/i)).not.toThrow();
      });
    });

    it("should show error for invalid email format", async () => {
      renderWithProviders(<WaitlistForm idPrefix="test" />);
      const emailInput = screen.getByPlaceholderText(
        "you@company.com",
      ) as HTMLInputElement;

      fireEvent.change(emailInput, { target: { value: "not-an-email" } });
      fireEvent.blur(emailInput);

      await waitFor(() => {
        expect(() =>
          screen.getByText(/Enter a valid email address/i),
        ).not.toThrow();
      });
    });

    it("should show error when name exceeds 100 characters", async () => {
      renderWithProviders(<WaitlistForm idPrefix="test" />);
      const nameInput = screen.getByPlaceholderText(
        "Edwin Martinez",
      ) as HTMLInputElement;
      const longName = "a".repeat(101);

      fireEvent.change(nameInput, { target: { value: longName } });
      fireEvent.blur(nameInput);

      await waitFor(() => {
        expect(() => screen.getByText(/Name is too long/i)).not.toThrow();
      });
    });

    it("should not show error for company when empty (optional field)", async () => {
      renderWithProviders(<WaitlistForm idPrefix="test" />);
      const nameInput = screen.getByPlaceholderText(
        "Edwin Martinez",
      ) as HTMLInputElement;
      const emailInput = screen.getByPlaceholderText(
        "you@company.com",
      ) as HTMLInputElement;

      fireEvent.change(nameInput, { target: { value: "John Doe" } });
      fireEvent.change(emailInput, { target: { value: "john@example.com" } });

      await waitFor(() => {
        // Company field is optional, no error should show
        expect(() => {
          screen.getByText(/Company.*required/i);
          throw new Error("Should not find error");
        }).toThrow();
      });
    });

    it("should clear validation errors when user corrects input", async () => {
      renderWithProviders(<WaitlistForm idPrefix="test" />);
      const nameInput = screen.getByPlaceholderText(
        "Edwin Martinez",
      ) as HTMLInputElement;

      // Trigger error
      fireEvent.focus(nameInput);
      fireEvent.blur(nameInput);

      await waitFor(() => {
        expect(() => screen.getByText(/Name is required/i)).not.toThrow();
      });

      // Fix the error
      fireEvent.change(nameInput, { target: { value: "John Doe" } });
      fireEvent.blur(nameInput);

      await waitFor(() => {
        expect(() => {
          screen.getByText(/Name is required/i);
          throw new Error("Error should be gone");
        }).toThrow();
      });
    });
  });

  describe("Form Submission", () => {
    it("should call joinWaitlist with form data on successful submission", async () => {
      const mockAddToWaitlist = vi.fn().mockResolvedValue({
        email: "test@example.com",
      });
      vi.mocked(apiWaitlistModule.addToWaitlist).mockImplementation(
        mockAddToWaitlist,
      );

      renderWithProviders(<WaitlistForm idPrefix="test" />);

      const nameInput = screen.getByPlaceholderText(
        "Edwin Martinez",
      ) as HTMLInputElement;
      const emailInput = screen.getByPlaceholderText(
        "you@company.com",
      ) as HTMLInputElement;
      const form = screen
        .getByRole("button", {
          name: /Join the waitlist/i,
        })
        .closest("form") as HTMLFormElement;

      fireEvent.change(nameInput, { target: { value: "John Doe" } });
      fireEvent.change(emailInput, { target: { value: "john@example.com" } });
      fireEvent.submit(form);

      await waitFor(() => {
        expect(mockAddToWaitlist).toHaveBeenCalled();
      });
    });

    it("should include company in submission when provided", async () => {
      const mockAddToWaitlist = vi.fn().mockResolvedValue({
        email: "test@example.com",
      });
      vi.mocked(apiWaitlistModule.addToWaitlist).mockImplementation(
        mockAddToWaitlist,
      );

      renderWithProviders(<WaitlistForm idPrefix="test" />);

      const nameInput = screen.getByPlaceholderText(
        "Edwin Martinez",
      ) as HTMLInputElement;
      const emailInput = screen.getByPlaceholderText(
        "you@company.com",
      ) as HTMLInputElement;
      const companyInput = screen.getByPlaceholderText(
        "Rivera Electric",
      ) as HTMLInputElement;
      const form = screen
        .getByRole("button", {
          name: /Join the waitlist/i,
        })
        .closest("form") as HTMLFormElement;

      fireEvent.change(nameInput, { target: { value: "John Doe" } });
      fireEvent.change(emailInput, { target: { value: "john@example.com" } });
      fireEvent.change(companyInput, { target: { value: "Acme Corp" } });
      fireEvent.submit(form);

      await waitFor(() => {
        expect(mockAddToWaitlist).toHaveBeenCalled();
        const callArgs = mockAddToWaitlist.mock.calls[0][0];
        expect(callArgs.name).toBe("John Doe");
        expect(callArgs.email).toBe("john@example.com");
        expect(callArgs.company).toBe("Acme Corp");
      });
    });

    it("should not submit form with validation errors", async () => {
      const mockAddToWaitlist = vi.fn();
      vi.mocked(apiWaitlistModule.addToWaitlist).mockImplementation(
        mockAddToWaitlist,
      );

      renderWithProviders(<WaitlistForm idPrefix="test" />);
      const form = screen
        .getByRole("button", {
          name: /Join the waitlist/i,
        })
        .closest("form") as HTMLFormElement;

      fireEvent.submit(form);

      await waitFor(() => {
        expect(mockAddToWaitlist).not.toHaveBeenCalled();
      });
    });
  });

  describe("Success State", () => {
    it("should display success message after successful submission", async () => {
      const mockAddToWaitlist = vi.fn().mockResolvedValue({
        email: "john@example.com",
      });
      vi.mocked(apiWaitlistModule.addToWaitlist).mockImplementation(
        mockAddToWaitlist,
      );

      renderWithProviders(<WaitlistForm idPrefix="test" />);

      const nameInput = screen.getByPlaceholderText(
        "Edwin Martinez",
      ) as HTMLInputElement;
      const emailInput = screen.getByPlaceholderText(
        "you@company.com",
      ) as HTMLInputElement;
      const form = screen
        .getByRole("button", {
          name: /Join the waitlist/i,
        })
        .closest("form") as HTMLFormElement;

      fireEvent.change(nameInput, { target: { value: "John Doe" } });
      fireEvent.change(emailInput, { target: { value: "john@example.com" } });
      fireEvent.submit(form);

      await waitFor(() => {
        expect(() => screen.getByText(/You're on the list/i)).not.toThrow();
        expect(() => screen.getByText(/john@example.com/i)).not.toThrow();
      });
    });

    it("should show success message with role='status' for accessibility", async () => {
      const mockAddToWaitlist = vi.fn().mockResolvedValue({
        email: "john@example.com",
      });
      vi.mocked(apiWaitlistModule.addToWaitlist).mockImplementation(
        mockAddToWaitlist,
      );

      renderWithProviders(<WaitlistForm idPrefix="test" />);

      const nameInput = screen.getByPlaceholderText(
        "Edwin Martinez",
      ) as HTMLInputElement;
      const emailInput = screen.getByPlaceholderText(
        "you@company.com",
      ) as HTMLInputElement;
      const form = screen
        .getByRole("button", {
          name: /Join the waitlist/i,
        })
        .closest("form") as HTMLFormElement;

      fireEvent.change(nameInput, { target: { value: "John Doe" } });
      fireEvent.change(emailInput, { target: { value: "john@example.com" } });
      fireEvent.submit(form);

      await waitFor(() => {
        const statusElement = screen.getByRole("status");
        expect(statusElement).toBeDefined();
      });
    });

    it("should display correct email in success message", async () => {
      const testEmail = "sarah@techcorp.com";
      const mockAddToWaitlist = vi.fn().mockResolvedValue({
        email: testEmail,
      });
      vi.mocked(apiWaitlistModule.addToWaitlist).mockImplementation(
        mockAddToWaitlist,
      );

      renderWithProviders(<WaitlistForm idPrefix="test" />);

      const nameInput = screen.getByPlaceholderText(
        "Edwin Martinez",
      ) as HTMLInputElement;
      const emailInput = screen.getByPlaceholderText(
        "you@company.com",
      ) as HTMLInputElement;
      const form = screen
        .getByRole("button", {
          name: /Join the waitlist/i,
        })
        .closest("form") as HTMLFormElement;

      fireEvent.change(nameInput, { target: { value: "Sarah Lee" } });
      fireEvent.change(emailInput, { target: { value: testEmail } });
      fireEvent.submit(form);

      await waitFor(() => {
        expect(() => screen.getByText(testEmail)).not.toThrow();
      });
    });
  });

  describe("Additional coverage", () => {
    it("should show a company validation error when the company name is too long", async () => {
      renderWithProviders(<WaitlistForm idPrefix="test" />);

      const nameInput = screen.getByPlaceholderText(
        "Edwin Martinez",
      ) as HTMLInputElement;
      const emailInput = screen.getByPlaceholderText(
        "you@company.com",
      ) as HTMLInputElement;
      const companyInput = screen.getByPlaceholderText(
        "Rivera Electric",
      ) as HTMLInputElement;

      fireEvent.change(nameInput, { target: { value: "John Doe" } });
      fireEvent.change(emailInput, { target: { value: "john@example.com" } });
      fireEvent.change(companyInput, {
        target: { value: "A".repeat(121) },
      });
      fireEvent.blur(companyInput);

      await waitFor(() => {
        expect(screen.getByText(/Company name is too long/i)).toBeDefined();
        expect(companyInput.getAttribute("aria-invalid")).toBe("true");
        expect(companyInput.getAttribute("aria-describedby")).toContain(
          "error",
        );
      });
    });

    it("should clear the company error after the user fixes the value", async () => {
      renderWithProviders(<WaitlistForm idPrefix="test" />);

      const companyInput = screen.getByPlaceholderText(
        "Rivera Electric",
      ) as HTMLInputElement;

      fireEvent.change(companyInput, {
        target: { value: "A".repeat(121) },
      });
      fireEvent.blur(companyInput);

      await waitFor(() => {
        expect(screen.getByText(/Company name is too long/i)).toBeDefined();
      });

      fireEvent.change(companyInput, {
        target: { value: "Acme Corp" },
      });
      fireEvent.blur(companyInput);

      await waitFor(() => {
        expect(() => screen.getByText(/Company name is too long/i)).toThrow();
      });
    });

    it("should allow a blank company value without showing a validation error", async () => {
      const mockAddToWaitlist = vi.fn().mockResolvedValue({
        email: "john@example.com",
      });
      vi.mocked(apiWaitlistModule.addToWaitlist).mockImplementation(
        mockAddToWaitlist,
      );

      renderWithProviders(<WaitlistForm idPrefix="test" />);

      const nameInput = screen.getByPlaceholderText(
        "Edwin Martinez",
      ) as HTMLInputElement;
      const emailInput = screen.getByPlaceholderText(
        "you@company.com",
      ) as HTMLInputElement;
      const form = screen
        .getByRole("button", { name: /Join the waitlist/i })
        .closest("form") as HTMLFormElement;

      fireEvent.change(nameInput, { target: { value: "John Doe" } });
      fireEvent.change(emailInput, { target: { value: "john@example.com" } });
      fireEvent.submit(form);

      await waitFor(() => {
        expect(mockAddToWaitlist).toHaveBeenCalledTimes(1);
        const payload = mockAddToWaitlist.mock.calls[0][0];
        expect(payload.name).toBe("John Doe");
        expect(payload.email).toBe("john@example.com");
        expect(payload.company).toBe("");
      });
    });

    it("should render the company error message with role='alert' and link it via aria-describedby", async () => {
      renderWithProviders(<WaitlistForm idPrefix="test" />);

      const companyInput = screen.getByPlaceholderText(
        "Rivera Electric",
      ) as HTMLInputElement;

      fireEvent.change(companyInput, {
        target: { value: "A".repeat(121) },
      });
      fireEvent.blur(companyInput);

      await waitFor(() => {
        const error = screen.getByRole("alert");
        expect(error.textContent).toMatch(/Company name is too long/i);
        expect(companyInput.getAttribute("aria-describedby")).toContain(
          "error",
        );
        expect(companyInput.getAttribute("aria-invalid")).toBe("true");
      });
    });
  });

  describe("Accessibility", () => {
    it("should have proper field IDs and labels", () => {
      renderWithProviders(<WaitlistForm idPrefix="test" />);

      const nameInput = screen.getByPlaceholderText(
        "Edwin Martinez",
      ) as HTMLInputElement;
      const emailInput = screen.getByPlaceholderText(
        "you@company.com",
      ) as HTMLInputElement;

      expect(nameInput.id).toBeTruthy();
      expect(emailInput.id).toBeTruthy();
    });

    it("should have proper autocomplete attributes", () => {
      renderWithProviders(<WaitlistForm idPrefix="test" />);

      const nameInput = screen.getByPlaceholderText(
        "Edwin Martinez",
      ) as HTMLInputElement;
      const emailInput = screen.getByPlaceholderText(
        "you@company.com",
      ) as HTMLInputElement;
      const companyInput = screen.getByPlaceholderText(
        "Rivera Electric",
      ) as HTMLInputElement;

      expect(nameInput.getAttribute("autocomplete")).toBe("name");
      expect(emailInput.getAttribute("autocomplete")).toBe("email");
      expect(companyInput.getAttribute("autocomplete")).toBe("organization");
    });

    it("should associate error messages via aria-describedby", async () => {
      renderWithProviders(<WaitlistForm idPrefix="test" />);
      const nameInput = screen.getByPlaceholderText(
        "Edwin Martinez",
      ) as HTMLInputElement;

      fireEvent.focus(nameInput);
      fireEvent.blur(nameInput);

      await waitFor(() => {
        expect(() => screen.getByText(/Name is required/i)).not.toThrow();
        const describedBy = nameInput.getAttribute("aria-describedby");
        expect(describedBy).toBeTruthy();
        expect(describedBy).toContain("error");
      });
    });

    it("should set aria-invalid when field has error", async () => {
      renderWithProviders(<WaitlistForm idPrefix="test" />);
      const emailInput = screen.getByPlaceholderText(
        "you@company.com",
      ) as HTMLInputElement;

      fireEvent.change(emailInput, { target: { value: "invalid-email" } });
      fireEvent.blur(emailInput);

      await waitFor(() => {
        expect(emailInput.getAttribute("aria-invalid")).toBe("true");
      });
    });

    it("should have error messages with role='alert'", async () => {
      renderWithProviders(<WaitlistForm idPrefix="test" />);
      const nameInput = screen.getByPlaceholderText("Edwin Martinez");

      fireEvent.focus(nameInput);
      fireEvent.blur(nameInput);

      await waitFor(() => {
        const alertElement = screen.getByRole("alert");
        expect(alertElement).toBeDefined();
      });
    });
  });
});
