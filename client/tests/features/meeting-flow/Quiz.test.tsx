import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { describe, expect, it, vi } from "vitest";

import { Quiz } from "../../../src/features/meeting-flow";
import theme from "../../../src/styles/theme";
import type { TalkQuizQuestion } from "../../../src/interfaces/talk";

const renderWithTheme = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

const questions: TalkQuizQuestion[] = [
  { question: "Q1?", choices: ["A", "B"], correctIndex: 0 },
  { question: "Q2?", choices: ["A", "B"], correctIndex: 1 },
  { question: "Q3?", choices: ["A", "B"], correctIndex: 0 },
];

describe("Quiz", () => {
  it("renders every question with its choices", () => {
    renderWithTheme(<Quiz questions={questions} onContinue={vi.fn()} />);

    expect(screen.getByText(/1\. Q1\?/)).toBeDefined();
    expect(screen.getByText(/2\. Q2\?/)).toBeDefined();
    expect(screen.getByText(/3\. Q3\?/)).toBeDefined();
    expect(screen.getAllByRole("radio")).toHaveLength(6);
  });

  it("disables Continue until every question has an answer", () => {
    renderWithTheme(<Quiz questions={questions} onContinue={vi.fn()} />);

    const continueButton = screen.getByRole("button", { name: /continue/i });
    expect(continueButton.hasAttribute("disabled")).toBe(true);

    const radiogroups = screen.getAllByRole("radiogroup");
    fireEvent.click(within(radiogroups[0]).getAllByRole("radio")[0]);
    expect(continueButton.hasAttribute("disabled")).toBe(true);

    fireEvent.click(within(radiogroups[1]).getAllByRole("radio")[0]);
    fireEvent.click(within(radiogroups[2]).getAllByRole("radio")[0]);
    expect(continueButton.hasAttribute("disabled")).toBe(false);
  });

  it("does not show a pass/fail result until every question is answered", () => {
    renderWithTheme(<Quiz questions={questions} onContinue={vi.fn()} />);
    expect(screen.queryByText(/correct/i)).toBeNull();
  });

  it("shows an all-correct result and calls onContinue with the selections", () => {
    const onContinue = vi.fn();
    renderWithTheme(<Quiz questions={questions} onContinue={onContinue} />);

    const radiogroups = screen.getAllByRole("radiogroup");
    fireEvent.click(within(radiogroups[0]).getAllByRole("radio")[0]); // correct (index 0)
    fireEvent.click(within(radiogroups[1]).getAllByRole("radio")[1]); // correct (index 1)
    fireEvent.click(within(radiogroups[2]).getAllByRole("radio")[0]); // correct (index 0)

    expect(screen.getByText("All 3 correct.")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    expect(onContinue).toHaveBeenCalledWith([
      { questionIndex: 0, selectedIndex: 0 },
      { questionIndex: 1, selectedIndex: 1 },
      { questionIndex: 2, selectedIndex: 0 },
    ]);
  });

  it("shows a partial-correct result without blocking Continue", () => {
    renderWithTheme(<Quiz questions={questions} onContinue={vi.fn()} />);

    const radiogroups = screen.getAllByRole("radiogroup");
    fireEvent.click(within(radiogroups[0]).getAllByRole("radio")[1]); // wrong
    fireEvent.click(within(radiogroups[1]).getAllByRole("radio")[1]); // correct
    fireEvent.click(within(radiogroups[2]).getAllByRole("radio")[1]); // wrong

    expect(screen.getByText(/1 of 3 correct/i)).toBeDefined();
    expect(
      screen.getByRole("button", { name: /continue/i }).hasAttribute("disabled"),
    ).toBe(false);
  });
});
