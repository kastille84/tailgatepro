import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider } from "styled-components";

import { TalkPresenter } from "../../../src/features/meeting-flow/TalkPresenter";
import theme from "../../../src/styles/theme";
import type { Talk } from "../../../src/interfaces/talk";

const mockUseTalkAudio = vi.fn();
vi.mock("../../../src/hooks/useTalkAudio", () => ({
  useTalkAudio: () => mockUseTalkAudio(),
}));

const mockUseCurrentUser = vi.fn();
vi.mock("../../../src/hooks/useCurrentUser", () => ({
  useCurrentUser: () => mockUseCurrentUser(),
}));

const talk: Talk = {
  id: "t1",
  slug: "fall-protection",
  title: "Fall Protection",
  tradeTag: "Roofing",
  tradeTags: ["Roofing"],
  content: "markdown body",
  structured: {
    summary: "Stay tied off above six feet.",
    talking_points: ["Inspect harnesses daily", "Tie off before stepping onto the roof"],
    site_hazards_to_check: ["Unguarded roof edges"],
    discussion_questions: ["What do you do if your harness looks worn?"],
    osha_standards: ["1926.501"],
    estimated_minutes: 10,
  },
  attribution: {
    source: "OSHA",
    publisher: "OSHA",
    copyright: "Public domain",
    license: "Public domain",
    source_url: null,
    notice: "Not an endorsement.",
  },
  quiz: null,
  translations: null,
  isGlobal: true,
  companyId: null,
  createdAt: "x",
};

const audioDefaults = {
  isSupported: true,
  voices: [],
  selectedVoiceURI: null,
  selectVoice: vi.fn(),
  matchVoiceToLanguage: vi.fn(),
  isSpeaking: false,
  speak: vi.fn(),
  stop: vi.fn(),
};

const renderPresenter = (
  props: Partial<React.ComponentProps<typeof TalkPresenter>> = {},
) =>
  render(
    <ThemeProvider theme={theme}>
      <TalkPresenter talk={talk} onContinue={vi.fn()} {...props} />
    </ThemeProvider>,
  );

describe("TalkPresenter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseTalkAudio.mockReturnValue({ ...audioDefaults });
    mockUseCurrentUser.mockReturnValue({ hasTranslationAccess: true });
  });

  it("renders the talk's structured sections and attribution", () => {
    renderPresenter();

    expect(screen.getByText("Stay tied off above six feet.")).toBeDefined();
    expect(screen.getByText("Inspect harnesses daily")).toBeDefined();
    expect(screen.getByText("Unguarded roof edges")).toBeDefined();
    expect(
      screen.getByText("What do you do if your harness looks worn?"),
    ).toBeDefined();
    expect(screen.getByText(/1926\.501/)).toBeDefined();
    expect(screen.getByText(/~10 min/)).toBeDefined();
    expect(screen.getByText(/public domain/i)).toBeDefined();
    expect(screen.getByText(/not an endorsement/i)).toBeDefined();
  });

  it("renders without any structured sections, attribution, or OSHA line when the talk has none", () => {
    const speak = vi.fn();
    mockUseTalkAudio.mockReturnValue({ ...audioDefaults, speak });
    renderPresenter({
      talk: { ...talk, structured: null, attribution: null },
    });

    expect(screen.queryByText(/talking points/i)).toBeNull();
    expect(screen.queryByText(/hazards to check/i)).toBeNull();
    expect(screen.queryByText(/osha/i)).toBeNull();
    expect(screen.queryByText(/public domain/i)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /read aloud/i }));
    expect(speak).toHaveBeenCalledWith("Fall Protection");
  });

  it("shows the OSHA line with only the minutes estimate when there are no OSHA standards", () => {
    renderPresenter({
      talk: {
        ...talk,
        structured: {
          ...talk.structured!,
          osha_standards: [],
          estimated_minutes: 5,
        },
      },
    });

    expect(screen.getByText("~5 min")).toBeDefined();
    expect(screen.queryByText(/OSHA:/)).toBeNull();
  });

  it("shows a fallback note instead of audio controls when TTS isn't supported", () => {
    mockUseTalkAudio.mockReturnValue({ ...audioDefaults, isSupported: false });
    renderPresenter();

    expect(screen.getByText(/isn.t available on this device/i)).toBeDefined();
    expect(screen.queryByRole("button", { name: /read aloud/i })).toBeNull();
  });

  it("speaks the composed summary, talking points, hazards, and discussion questions when Read aloud is clicked", () => {
    const speak = vi.fn();
    mockUseTalkAudio.mockReturnValue({ ...audioDefaults, speak });
    renderPresenter();

    fireEvent.click(screen.getByRole("button", { name: /read aloud/i }));

    expect(speak).toHaveBeenCalledWith(
      "Fall Protection. Stay tied off above six feet. Inspect harnesses daily. Tie off before stepping onto the roof. Unguarded roof edges. What do you do if your harness looks worn?",
    );
  });

  it("shows Stop reading and calls stop while speaking", () => {
    const stop = vi.fn();
    mockUseTalkAudio.mockReturnValue({
      ...audioDefaults,
      isSpeaking: true,
      stop,
    });
    renderPresenter();

    fireEvent.click(screen.getByRole("button", { name: /stop reading/i }));

    expect(stop).toHaveBeenCalled();
  });

  it("renders a voice picker when voices are available and reports a selection", () => {
    const selectVoice = vi.fn();
    mockUseTalkAudio.mockReturnValue({
      ...audioDefaults,
      voices: [{ voiceURI: "v1", lang: "en-US", name: "Alex" }],
      selectVoice,
    });
    renderPresenter();

    fireEvent.change(screen.getByLabelText(/^voice$/i), {
      target: { value: "v1" },
    });

    expect(selectVoice).toHaveBeenCalledWith("v1");
  });

  it("renders the OSHA line without a minutes suffix when estimated_minutes is null", () => {
    renderPresenter({
      talk: {
        ...talk,
        structured: { ...talk.structured!, estimated_minutes: null },
      },
    });

    expect(screen.getByText("OSHA: 1926.501")).toBeDefined();
    expect(screen.queryByText(/~.*min/)).toBeNull();
  });

  it("calls onContinue when Continue is clicked", () => {
    const onContinue = vi.fn();
    renderPresenter({ onContinue });

    fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));

    expect(onContinue).toHaveBeenCalled();
  });

  describe("language switcher", () => {
    const talkWithSpanish: Talk = {
      ...talk,
      isGlobal: false,
      translations: {
        es: {
          title: "Protección contra Caídas",
          summary: "Permanezca atado por encima de seis pies.",
          talking_points: ["Inspeccione los arneses diariamente"],
          site_hazards_to_check: ["Bordes de techo sin protección"],
          discussion_questions: ["¿Qué hace si su arnés se ve desgastado?"],
        },
      },
    };

    it("renders no language selector for a talk with no translations", () => {
      renderPresenter();
      expect(screen.queryByLabelText(/^language$/i)).toBeNull();
    });

    it("renders no language selector, and shows only English, when the caller's tier lacks translation access", () => {
      mockUseCurrentUser.mockReturnValue({ hasTranslationAccess: false });
      renderPresenter({ talk: talkWithSpanish });

      expect(screen.queryByLabelText(/^language$/i)).toBeNull();
      expect(screen.getByText("Stay tied off above six feet.")).toBeDefined();
      expect(screen.queryByText(/machine-translated/i)).toBeNull();
    });

    it("switches displayed and spoken text, matches the voice, and shows the machine-translation disclaimer for a non-global talk", () => {
      const matchVoiceToLanguage = vi.fn();
      const speak = vi.fn();
      mockUseTalkAudio.mockReturnValue({
        ...audioDefaults,
        matchVoiceToLanguage,
        speak,
      });
      renderPresenter({ talk: talkWithSpanish });

      expect(screen.getByText("Stay tied off above six feet.")).toBeDefined();

      fireEvent.change(screen.getByLabelText(/^language$/i), {
        target: { value: "es" },
      });

      expect(matchVoiceToLanguage).toHaveBeenCalledWith("es");
      expect(
        screen.getByText("Permanezca atado por encima de seis pies."),
      ).toBeDefined();
      expect(screen.getByText(/machine-translated/i)).toBeDefined();

      fireEvent.click(screen.getByRole("button", { name: /read aloud/i }));
      expect(speak).toHaveBeenCalledWith(
        "Protección contra Caídas. Permanezca atado por encima de seis pies. Inspeccione los arneses diariamente. Bordes de techo sin protección. ¿Qué hace si su arnés se ve desgastado?",
      );
    });

    it("does not show the machine-translation disclaimer for a global talk's translation", () => {
      renderPresenter({ talk: { ...talkWithSpanish, isGlobal: true } });

      fireEvent.change(screen.getByLabelText(/^language$/i), {
        target: { value: "es" },
      });

      expect(screen.queryByText(/machine-translated/i)).toBeNull();
    });
  });
});
