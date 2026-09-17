import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  act,
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import { ThemeProvider } from "styled-components";

import { SignaturesStep } from "../../../src/features/meeting-flow/SignaturesStep";
import theme from "../../../src/styles/theme";
import type { Talk, TalkQuizQuestion } from "../../../src/interfaces/talk";
import type { DraftSigner } from "../../../src/interfaces/meetingDraft";

// jsdom has no real 2D canvas context, so — same approach as
// SignaturePad.test.tsx — this mocks the signature_pad library boundary
// itself, letting the real SignaturePad (and therefore the real
// SignaturesStep wiring around it) run under test.
const { mockPadInstances, MockSignaturePad } = vi.hoisted(() => {
  class MockSignaturePad {
    listeners: Record<string, Array<() => void>> = {};
    isEmptyValue = true;
    onFn = vi.fn();
    offFn = vi.fn();
    clearFn = vi.fn();
    toDataURLFn = vi.fn(() => "data:image/png;base64,AAAA");

    addEventListener(type: string, callback: () => void) {
      (this.listeners[type] ??= []).push(callback);
    }
    removeEventListener(type: string, callback: () => void) {
      this.listeners[type] = (this.listeners[type] ?? []).filter(
        (listener) => listener !== callback,
      );
    }
    on() {
      this.onFn();
    }
    off() {
      this.offFn();
    }
    clear() {
      this.clearFn();
    }
    isEmpty() {
      return this.isEmptyValue;
    }
    toDataURL(type?: string) {
      return this.toDataURLFn(type);
    }
    emit(type: string) {
      (this.listeners[type] ?? []).forEach((listener) => listener());
    }
  }

  return {
    mockPadInstances: [] as InstanceType<typeof MockSignaturePad>[],
    MockSignaturePad,
  };
});

vi.mock("signature_pad", () => ({
  default: vi.fn().mockImplementation(() => {
    const pad = new MockSignaturePad();
    mockPadInstances.push(pad);
    return pad;
  }),
}));

const quizQuestions: TalkQuizQuestion[] = [
  { question: "Q1?", choices: ["A", "B"], correctIndex: 0 },
  { question: "Q2?", choices: ["A", "B"], correctIndex: 1 },
];

const baseTalk: Talk = {
  id: "t1",
  slug: "fall-protection",
  title: "Fall Protection",
  tradeTag: "Roofing",
  tradeTags: ["Roofing"],
  content: "markdown body",
  structured: null,
  attribution: null,
  quiz: quizQuestions,
  isGlobal: true,
  companyId: null,
  createdAt: "x",
};

const existingSigner: DraftSigner = {
  localId: "s1",
  workerName: "Jordan",
  quizAnswers: [
    { questionIndex: 0, selectedIndex: 0 },
    { questionIndex: 1, selectedIndex: 1 },
  ],
  signatureBlob: new Blob(["png"], { type: "image/png" }),
};

const renderStep = (
  props: Partial<React.ComponentProps<typeof SignaturesStep>> = {},
) =>
  render(
    <ThemeProvider theme={theme}>
      <SignaturesStep
        talk={baseTalk}
        signers={[]}
        onAddSigner={vi.fn()}
        onRemoveSigner={vi.fn()}
        onContinue={vi.fn()}
        {...props}
      />
    </ThemeProvider>,
  );

const drawSignature = () => {
  const pad = mockPadInstances[mockPadInstances.length - 1];
  pad.isEmptyValue = false;
  act(() => {
    pad.emit("endStroke");
  });
  return pad;
};

describe("SignaturesStep", () => {
  beforeEach(() => {
    mockPadInstances.length = 0;
  });

  it("shows an empty state and disables Continue when no signers are collected", () => {
    renderStep();

    expect(screen.getByText(/no signatures collected yet/i)).toBeDefined();
    expect(
      screen
        .getByRole("button", { name: /^continue$/i })
        .hasAttribute("disabled"),
    ).toBe(true);
  });

  it("lists collected signers with a quiz badge and calls onContinue once enabled", () => {
    const onContinue = vi.fn();
    renderStep({ signers: [existingSigner], onContinue });

    expect(screen.getByText("Jordan")).toBeDefined();
    expect(screen.getByText(/quiz: 2 answered/i)).toBeDefined();
    expect(screen.getByText("1 signature collected.")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));
    expect(onContinue).toHaveBeenCalled();
  });

  it("shows a No quiz badge for a signer added from a talk with no quiz, and pluralizes the count", () => {
    const noQuizSigner: DraftSigner = {
      localId: "s2",
      workerName: "Sam",
      quizAnswers: null,
      signatureBlob: new Blob(["png"], { type: "image/png" }),
    };

    renderStep({ signers: [existingSigner, noQuizSigner] });

    expect(screen.getByText("2 signatures collected.")).toBeDefined();
    expect(screen.getByText("No quiz")).toBeDefined();
  });

  it("calls onRemoveSigner with the signer's localId", () => {
    const onRemoveSigner = vi.fn();
    renderStep({ signers: [existingSigner], onRemoveSigner });

    fireEvent.click(screen.getByRole("button", { name: /remove jordan/i }));

    expect(onRemoveSigner).toHaveBeenCalledWith("s1");
  });

  it("collects a name, quiz answers, and a signature, then hands back a new signer", async () => {
    const onAddSigner = vi.fn();
    renderStep({ onAddSigner });

    fireEvent.click(screen.getByRole("button", { name: /add worker/i }));

    fireEvent.change(screen.getByLabelText(/worker's name/i), {
      target: { value: "Alex Rivera" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));

    // Quiz stage — answer both questions.
    const radiogroups = screen.getAllByRole("radiogroup");
    fireEvent.click(within(radiogroups[0]).getAllByRole("radio")[0]);
    fireEvent.click(within(radiogroups[1]).getAllByRole("radio")[1]);
    fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));

    // Sign stage.
    drawSignature();
    fireEvent.click(screen.getByRole("button", { name: /save signature/i }));

    // handleSaveSignature awaits SignaturePad's exportBlob() before calling
    // onAddSigner, so the call lands a microtask after the click.
    await waitFor(() => expect(onAddSigner).toHaveBeenCalledTimes(1));
    const signer = onAddSigner.mock.calls[0][0] as DraftSigner;
    expect(signer.workerName).toBe("Alex Rivera");
    expect(signer.quizAnswers).toEqual([
      { questionIndex: 0, selectedIndex: 0 },
      { questionIndex: 1, selectedIndex: 1 },
    ]);
    expect(signer.signatureBlob).toBeInstanceOf(Blob);
    expect(typeof signer.localId).toBe("string");
  });

  it("skips the quiz stage entirely for a talk with no quiz", () => {
    renderStep({ talk: { ...baseTalk, quiz: null } });

    fireEvent.click(screen.getByRole("button", { name: /add worker/i }));
    fireEvent.change(screen.getByLabelText(/worker's name/i), {
      target: { value: "Sam" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));

    // No quiz radios should appear — straight to the signature pad.
    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.getByRole("img")).toBeDefined();
  });

  it("returns to the list without adding a signer when Cancel is clicked", () => {
    const onAddSigner = vi.fn();
    renderStep({ onAddSigner });

    fireEvent.click(screen.getByRole("button", { name: /add worker/i }));
    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));

    expect(screen.getByText(/no signatures collected yet/i)).toBeDefined();
    expect(onAddSigner).not.toHaveBeenCalled();
  });

  it("disables Save signature until a stroke has been drawn", () => {
    renderStep({ talk: { ...baseTalk, quiz: null } });

    fireEvent.click(screen.getByRole("button", { name: /add worker/i }));
    fireEvent.change(screen.getByLabelText(/worker's name/i), {
      target: { value: "Sam" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));

    expect(
      screen
        .getByRole("button", { name: /save signature/i })
        .hasAttribute("disabled"),
    ).toBe(true);

    drawSignature();

    expect(
      screen
        .getByRole("button", { name: /save signature/i })
        .hasAttribute("disabled"),
    ).toBe(false);
  });
});
