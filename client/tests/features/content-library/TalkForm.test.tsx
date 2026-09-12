import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ThemeProvider } from "styled-components";

import { TalkForm } from "../../../src/features/content-library/TalkForm";
import theme from "../../../src/styles/theme";

const mockCreate = vi.fn();
const mockUseTalks = vi.fn();

vi.mock("../../../src/hooks/useCreateTalk", () => ({
  useCreateTalk: () => ({ createTalk: mockCreate, isCreating: false }),
}));
vi.mock("../../../src/hooks/useTalks", () => ({
  useTalks: (...args: unknown[]) => mockUseTalks(...args),
}));

// BulletListEditor has its own tests (ui_comps/bullet-list-editor); stub it
// here as a plain textarea (one line per bullet) so TalkForm's tests stay
// focused on TalkForm's own logic — assembling the payload, wiring
// Controller, surfacing validation and mutation errors.
vi.mock("../../../src/ui_comps/bullet-list-editor", () => ({
  BulletListEditor: ({
    id,
    value,
    onChange,
    hasError,
    "aria-describedby": ariaDescribedBy,
  }: {
    id?: string;
    value: string[];
    onChange: (items: string[]) => void;
    hasError?: boolean;
    "aria-describedby"?: string;
  }) => (
    <textarea
      id={id}
      aria-invalid={hasError}
      aria-describedby={ariaDescribedBy}
      value={value.join("\n")}
      onChange={(event) =>
        onChange(event.target.value.split("\n").filter((line) => line.trim() !== ""))
      }
    />
  ),
}));

const renderForm = (
  props: Partial<React.ComponentProps<typeof TalkForm>> = {},
) =>
  render(
    <ThemeProvider theme={theme}>
      <TalkForm isOpen onClose={vi.fn()} {...props} />
    </ThemeProvider>,
  );

describe("TalkForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockResolvedValue(undefined);
    mockUseTalks.mockReturnValue({
      talks: [],
      tradeOptions: [
        { value: "Electrical", label: "Electrical" },
        { value: "Roofing", label: "Roofing" },
      ],
      isLoading: false,
      isError: false,
    });
  });

  it("renders nothing when closed", () => {
    renderForm({ isOpen: false });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("creates a talk with the minimum required fields and closes on submit", async () => {
    const onClose = vi.fn();
    renderForm({ onClose });

    expect(screen.getByText("New talk")).toBeDefined();
    fireEvent.change(screen.getByLabelText(/^title$/i), {
      target: { value: "Ladder Safety Refresher" },
    });
    fireEvent.change(screen.getByLabelText(/talking points/i), {
      target: { value: "Inspect rungs before use" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create talk/i }));

    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith({
        title: "Ladder Safety Refresher",
        tradeTag: undefined,
        summary: undefined,
        talkingPoints: ["Inspect rungs before use"],
        siteHazardsToCheck: [],
        discussionQuestions: [],
        oshaStandards: [],
        estimatedMinutes: undefined,
      }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("shows validation errors and does not submit when required fields are empty", async () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: /create talk/i }));

    await waitFor(() =>
      expect(screen.getByText(/title is required/i)).toBeDefined(),
    );
    expect(screen.getByText(/add at least one talking point/i)).toBeDefined();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("keeps the modal open when the mutation rejects", async () => {
    const onClose = vi.fn();
    mockCreate.mockRejectedValue(new Error("This talk already exists"));
    renderForm({ onClose });

    fireEvent.change(screen.getByLabelText(/^title$/i), {
      target: { value: "Dupe" },
    });
    fireEvent.change(screen.getByLabelText(/talking points/i), {
      target: { value: "A point" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create talk/i }));

    await waitFor(() => expect(mockCreate).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();
  });

  it("sends the full structured payload when every field is filled in", async () => {
    renderForm();

    fireEvent.change(screen.getByLabelText(/^title$/i), {
      target: { value: "Arc Flash Refresher" },
    });
    fireEvent.change(screen.getByLabelText(/^trade/i), {
      target: { value: "Electrical" },
    });
    fireEvent.change(screen.getByLabelText(/summary/i), {
      target: { value: "Keep clear of energized panels." },
    });
    fireEvent.change(screen.getByLabelText(/talking points/i), {
      target: { value: "De-energize first\nWear arc-rated PPE" },
    });
    fireEvent.change(screen.getByLabelText(/hazards to check on site/i), {
      target: { value: "Exposed wiring" },
    });
    fireEvent.change(screen.getByLabelText(/discussion questions/i), {
      target: { value: "What PPE is required?" },
    });

    fireEvent.click(screen.getByRole("button", { name: /add osha standard/i }));
    fireEvent.change(screen.getByLabelText(/^osha standard 1$/i), {
      target: { value: "29 CFR 1926.416" },
    });

    fireEvent.change(screen.getByLabelText(/estimated minutes/i), {
      target: { value: "5" },
    });

    fireEvent.click(screen.getByRole("button", { name: /create talk/i }));

    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith({
        title: "Arc Flash Refresher",
        tradeTag: "Electrical",
        summary: "Keep clear of energized panels.",
        talkingPoints: ["De-energize first", "Wear arc-rated PPE"],
        siteHazardsToCheck: ["Exposed wiring"],
        discussionQuestions: ["What PPE is required?"],
        oshaStandards: ["29 CFR 1926.416"],
        estimatedMinutes: 5,
      }),
    );
  });

  it("removes an OSHA standard row before submit, sending only what remains", async () => {
    renderForm();

    fireEvent.change(screen.getByLabelText(/^title$/i), {
      target: { value: "T" },
    });
    fireEvent.change(screen.getByLabelText(/talking points/i), {
      target: { value: "A point" },
    });

    fireEvent.click(screen.getByRole("button", { name: /add osha standard/i }));
    fireEvent.click(screen.getByRole("button", { name: /add osha standard/i }));
    fireEvent.change(screen.getByLabelText(/^osha standard 1$/i), {
      target: { value: "29 CFR 1926.416" },
    });
    // Row 2 is left blank, then removed before submit — a blank row that's
    // still present would fail validation instead (see the next test).
    fireEvent.click(
      screen.getByRole("button", { name: /remove osha standard 2/i }),
    );

    fireEvent.click(screen.getByRole("button", { name: /create talk/i }));

    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ oshaStandards: ["29 CFR 1926.416"] }),
      ),
    );
  });

  it("blocks submission when an OSHA standard row is left blank", async () => {
    renderForm();

    fireEvent.change(screen.getByLabelText(/^title$/i), {
      target: { value: "T" },
    });
    fireEvent.change(screen.getByLabelText(/talking points/i), {
      target: { value: "A point" },
    });
    fireEvent.click(screen.getByRole("button", { name: /add osha standard/i }));
    fireEvent.click(screen.getByRole("button", { name: /create talk/i }));

    await waitFor(() => expect(screen.getByText(/can't be blank/i)).toBeDefined());
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("rejects a non-numeric estimated-minutes value", async () => {
    renderForm();

    fireEvent.change(screen.getByLabelText(/^title$/i), {
      target: { value: "T" },
    });
    fireEvent.change(screen.getByLabelText(/talking points/i), {
      target: { value: "A point" },
    });
    fireEvent.change(screen.getByLabelText(/estimated minutes/i), {
      target: { value: "600" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create talk/i }));

    await waitFor(() =>
      expect(
        screen.getByText(/estimated minutes must be a positive number/i),
      ).toBeDefined(),
    );
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("flags an over-long trade or summary", async () => {
    renderForm();

    fireEvent.change(screen.getByLabelText(/^title$/i), {
      target: { value: "T" },
    });
    fireEvent.change(screen.getByLabelText(/talking points/i), {
      target: { value: "A point" },
    });
    fireEvent.change(screen.getByLabelText(/^trade/i), {
      target: { value: "x".repeat(61) },
    });
    fireEvent.change(screen.getByLabelText(/summary/i), {
      target: { value: "x".repeat(1001) },
    });
    fireEvent.click(screen.getByRole("button", { name: /create talk/i }));

    await waitFor(() =>
      expect(screen.getByText(/trade is too long/i)).toBeDefined(),
    );
    expect(screen.getByText(/summary is too long/i)).toBeDefined();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("offers the known trades as datalist suggestions", () => {
    renderForm();
    const tradeInput = screen.getByLabelText(/^trade/i) as HTMLInputElement;
    const datalist = document.getElementById(tradeInput.getAttribute("list")!);
    expect(datalist?.querySelectorAll("option")).toHaveLength(2);
  });

  it("closes without creating when Cancel is clicked", () => {
    const onClose = vi.fn();
    renderForm({ onClose });

    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));

    expect(onClose).toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
